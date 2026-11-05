import { z } from 'zod';
import { ROUTE_NAME } from '#shared/contract/keys.ts';
import { HTTP_METHOD, STATUS } from '#wrapper/http/keys.ts';
import { errorResponse, jsonResponse } from '#wrapper/http/responses.ts';
import type { DevRoute, RequestContext } from '#wrapper/feature-types.ts';
import { LAST_WORD, NUMBER_WORD, REPORT_KIND, REPORT_QUERY, ROUTE_OP } from '../keys.ts';
import { ROUTE_TEXT as TEXT, WRAPPER_TEXT } from '../text.ts';
import type { DiagnosticsService } from '../services/diagnostics.ts';
import type { DiagnosticReport } from '../domain/report.ts';

const PAGE_KINDS = [REPORT_KIND.pageError, REPORT_KIND.unhandledRejection] as const;
const requestSchema = z.object({
  op: z.string(),
  kind: z.enum(PAGE_KINDS).optional(),
  note: z.string().optional(),
  error: z.object({
    name: z.string().optional(), message: z.string().optional(), stack: z.string().optional(), source: z.string().optional(),
    line: z.number().nullable().optional(), column: z.number().nullable().optional(),
  }).optional(),
});

export type RouteCapabilities = { capture: boolean; show: boolean };
export type RouteDeps = { service: DiagnosticsService; capabilities: RouteCapabilities };

const summary = (report: DiagnosticReport) => ({ id: report.id, time: report.time, kind: report.kind, client: report.client, message: report.error.message });

function chosenReport(reports: readonly DiagnosticReport[], word: string): DiagnosticReport | null {
  if (word === LAST_WORD) return reports.at(-1) ?? null;
  return NUMBER_WORD.test(word) ? reports[Number(word)] ?? null : null;
}

export function diagnosticsRoute({ service, capabilities }: RouteDeps): DevRoute {
  function read(url: URL): Response {
    const reports = service.reports();
    const word = url.searchParams.get(REPORT_QUERY);
    if (word === null) return jsonResponse({ capture: capabilities.capture, reports: reports.map(summary) });
    const report = chosenReport(reports, word);
    return report ? jsonResponse(report) : errorResponse(TEXT.noReport, STATUS.notFound);
  }

  async function write(request: Request): Promise<Response> {
    const parsed = requestSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return errorResponse(TEXT.invalid, STATUS.badRequest);
    const { op, kind, error, note } = parsed.data;
    if (op === ROUTE_OP.report) {
      if (!capabilities.capture) return errorResponse(TEXT.capabilityOff, STATUS.notFound);
      if (!kind || !error) return errorResponse(TEXT.invalid, STATUS.badRequest);
      return jsonResponse({ saved: service.capture(kind, error) !== null });
    }
    if (!capabilities.show) return errorResponse(TEXT.capabilityOff, STATUS.notFound);
    if (op === ROUTE_OP.manual) {
      const report = service.capture(REPORT_KIND.manual, { name: WRAPPER_TEXT.manualName, message: note || WRAPPER_TEXT.manualMessage });
      return jsonResponse({ saved: report !== null });
    }
    if (op === ROUTE_OP.clear) return jsonResponse({ cleared: service.clear() });
    return errorResponse(TEXT.unknownOperation, STATUS.badRequest);
  }

  async function handle(request: Request, url: URL, context: RequestContext): Promise<Response> {
    if (context.remote) return errorResponse(TEXT.notHere, STATUS.forbidden);
    if (request.method === HTTP_METHOD.post) return write(request);
    return capabilities.show ? read(url) : errorResponse(TEXT.capabilityOff, STATUS.notFound);
  }

  return { name: ROUTE_NAME.diagnostics, handle };
}

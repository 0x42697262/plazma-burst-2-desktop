import { CAPABILITY, FEATURE } from '#shared/features/keys.ts';
import { ROUTE } from '#shared/contract/routes.ts';
import { HTTP_METHOD } from '#shared/contract/keys.ts';
import { isCapabilityOn } from '#console/flags.ts';
import type { PageFeature } from '#page/feature-types.ts';
import { PAGE_EVENT, REPORT_KIND, ROUTE_OP } from './keys.ts';
import { WRAPPER_TEXT as TEXT } from './text.ts';

type PageError = { name?: string; message?: string; stack?: string; source?: string; line?: number | null; column?: number | null };

const ignore = (): void => undefined;

function sendReport(kind: string, error: PageError): void {
  fetch(ROUTE.diagnostics, { method: HTTP_METHOD.post, body: JSON.stringify({ op: ROUTE_OP.report, kind, error }) }).catch(ignore);
}

function onError(event: ErrorEvent): void {
  const error = event.error as Error | null | undefined;
  sendReport(REPORT_KIND.pageError, { name: error?.name ?? '', message: event.message, stack: error?.stack ?? '', source: event.filename, line: event.lineno, column: event.colno });
}

function onRejection(event: PromiseRejectionEvent): void {
  const reason = event.reason as Partial<Error> | string | null | undefined;
  const isError = typeof reason === 'object' && reason !== null;
  sendReport(REPORT_KIND.unhandledRejection, { name: (isError ? reason.name : '') || TEXT.rejectionName, message: isError ? reason.message ?? '' : String(reason), stack: isError ? reason.stack ?? '' : '' });
}

export const diagnosticsPage: PageFeature = Object.freeze({
  id: FEATURE.diagnostics,
  start(): void {
    if (!isCapabilityOn(CAPABILITY.diagnostics.capture)) return;
    globalThis.addEventListener?.(PAGE_EVENT.error, onError as EventListener);
    globalThis.addEventListener?.(PAGE_EVENT.rejection, onRejection as EventListener);
  },
});

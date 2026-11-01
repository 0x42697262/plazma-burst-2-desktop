import { ROUTE_NAME } from '#shared/contract/keys.ts';
import { HTTP_METHOD, STATUS } from '#wrapper/http/keys.ts';
import { errorResponse, jsonResponse } from '#wrapper/http/responses.ts';
import type { DevRoute, RequestContext } from '#wrapper/feature-types.ts';
import { OPERATIONS, type Operation } from '../keys.ts';
import { ROUTE_TEXT } from '../text.ts';
import type { ServerListService } from '../services/server-list.ts';

type RouteBody = { op?: unknown; arg?: unknown };

const isOperation = (value: unknown): value is Operation => typeof value === 'string' && OPERATIONS.includes(value);

export function serverListRoute(service: ServerListService): DevRoute {
  async function handle(request: Request, _url: URL, context: RequestContext): Promise<Response> {
    if (context.remote || context.server) return errorResponse(ROUTE_TEXT.notAvailable, STATUS.forbidden);
    if (request.method !== HTTP_METHOD.post) return errorResponse(ROUTE_TEXT.postOnly, STATUS.methodNotAllowed);
    let body: RouteBody | null;
    try {
      body = JSON.parse(await request.text()) as RouteBody | null;
    } catch {
      return errorResponse(ROUTE_TEXT.invalidJson, STATUS.badRequest);
    }
    if (!body || !isOperation(body.op)) return errorResponse(ROUTE_TEXT.unknownOperation, STATUS.badRequest);
    const operation = service.operations[body.op] as (argument: unknown) => unknown;
    try {
      return jsonResponse({ ok: true, value: await operation(body.arg) });
    } catch (error) {
      return jsonResponse({ ok: false, error: (error as Error).message });
    }
  }
  return { name: ROUTE_NAME.servers, handle };
}

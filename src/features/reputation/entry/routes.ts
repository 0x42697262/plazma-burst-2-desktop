import { ROUTE_NAME } from '#shared/contract/keys.ts';
import { STATUS } from '#wrapper/http/keys.ts';
import { errorResponse, jsonResponse } from '#wrapper/http/responses.ts';
import type { DevRoute, RequestContext } from '#wrapper/feature-types.ts';
import { ROUTE_TEXT } from '../text.ts';
import type { SaveWatch } from '../services/save-watch.ts';

export function deviceRoutes({ watch }: Readonly<{ watch: SaveWatch }>): DevRoute[] {
  const handle = (_request: Request, _url: URL, context: RequestContext): Promise<Response> => Promise.resolve(
    context.remote ? errorResponse(ROUTE_TEXT.notInRemotePlay, STATUS.forbidden) : jsonResponse(watch.snapshot()),
  );
  return [{ name: ROUTE_NAME.device, handle }];
}

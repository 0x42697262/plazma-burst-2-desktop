import { ROUTE_NAME } from '#shared/contract/keys.ts';
import { HTTP_METHOD, STATUS } from '#wrapper/http/keys.ts';
import { errorResponse, jsonResponse } from '#wrapper/http/responses.ts';
import type { DevRoute, RequestContext } from '#wrapper/feature-types.ts';
import { LOG_LEVEL } from '#kernel/log/constants.ts';
import type { Logger } from '#kernel/log/logger.ts';
import { FINGERPRINT_EVENT } from '../events.ts';
import { KIND_QUERY, STATUS as SAVE_STATUS } from '../keys.ts';
import { ROUTE_TEXT, STORE_TEXT } from '../text.ts';
import type { FingerprintStore } from '../adapters/store.ts';

export type FingerprintRouteDeps = { store: FingerprintStore; folderName: string; log: Logger };

export function fingerprintRoutes({ store, folderName, log }: FingerprintRouteDeps): DevRoute[] {
  const shownFile = (file: string): string => STORE_TEXT.relativeFile(folderName, file);
  const refuseRemote = (context: RequestContext): Response | null => (context.remote ? errorResponse(ROUTE_TEXT.notInRemotePlay, STATUS.forbidden) : null);

  async function one(request: Request, url: URL, context: RequestContext): Promise<Response> {
    const refused = refuseRemote(context);
    if (refused) return refused;
    try {
      if (request.method === HTTP_METHOD.post) {
        const saved = await store.save(await request.text(), url.searchParams.get(KIND_QUERY));
        const isNew = saved.status === SAVE_STATUS.new;
        if (saved.status !== SAVE_STATUS.same) {
          log.event(LOG_LEVEL.info, isNew ? FINGERPRINT_EVENT.saved : FINGERPRINT_EVENT.updated, { message: STORE_TEXT.savedLog(saved.id, isNew, shownFile(saved.file)) });
        }
        return jsonResponse({ ...saved, file: shownFile(saved.file) });
      }
      const latest = await store.latest();
      return latest ? jsonResponse({ ...latest, file: shownFile(latest.file) }) : errorResponse(ROUTE_TEXT.noneSaved, STATUS.notFound);
    } catch (error) {
      return errorResponse((error as Error).message, STATUS.badRequest);
    }
  }

  async function all(_request: Request, _url: URL, context: RequestContext): Promise<Response> {
    return refuseRemote(context) ?? jsonResponse(await store.list());
  }

  return [
    { name: ROUTE_NAME.fingerprint, handle: one },
    { name: ROUTE_NAME.fingerprints, handle: all },
  ];
}

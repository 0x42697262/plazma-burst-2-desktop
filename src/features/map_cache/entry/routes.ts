import { ROUTE_NAME, MAP_MARKER } from '#shared/contract/keys.ts';
import { HTTP_METHOD, STATUS } from '#wrapper/http/keys.ts';
import { errorResponse, jsonResponse, notFound, textResponse } from '#wrapper/http/responses.ts';
import type { DevRoute, Interceptor, RequestContext } from '#wrapper/feature-types.ts';
import { StatusError } from '#wrapper/http/status-error.ts';
import { MAP_REQUEST, NOT_PUBLISHED_ANSWER, QUERY, SERVER_SCRIPT_PATH, CONTENT_TYPE_HEADER } from '../keys.ts';
import { TEXT } from '../text.ts';
import { isLocalMapId, localNameOf } from '../domain/map-id.ts';
import type { MapFiles } from '../adapters/map-files.ts';

export type MapRouteDeps = { files: MapFiles; host: string; info: (message: string) => void; error: (message: string) => void };
type ContextWithFetch = RequestContext & { fetch?: (request: Request) => Promise<Response> };

export function mapRoutes({ files }: Pick<MapRouteDeps, 'files'>): DevRoute[] {
  const isPost = (request: Request): boolean => request.method === HTTP_METHOD.post;
  return [
    { name: ROUTE_NAME.maps, handle: async () => jsonResponse(await files.listLocal()) },
    {
      name: ROUTE_NAME.saveMap,
      handle: async (request, url) => {
        if (!isPost(request)) return notFound();
        try {
          return new Response(await files.save(url.searchParams.get(QUERY.id), await request.text()));
        } catch (error) {
          return errorResponse((error as Error).message, STATUS.badRequest);
        }
      },
    },
    {
      name: ROUTE_NAME.saveEdited,
      handle: async (request, url) => {
        if (!isPost(request)) return notFound();
        try {
          const overwrite = url.searchParams.get(QUERY.overwrite) === QUERY.overwriteYes;
          return jsonResponse(await files.saveEdited(url.searchParams.get(QUERY.name), await request.text(), overwrite));
        } catch (error) {
          return errorResponse((error as Error).message, error instanceof StatusError ? error.status : STATUS.serverError);
        }
      },
    },
    {
      name: ROUTE_NAME.localMap,
      handle: async (_request, url) => {
        const file = await files.findLocal((url.searchParams.get(QUERY.name) ?? '').trim());
        return file ? textResponse(await files.readLocal(file)) : notFound();
      },
    },
    {
      name: ROUTE_NAME.mapFile,
      handle: async (_request, url) => {
        const text = await files.readSaved(url.searchParams.get(QUERY.id));
        return text ? textResponse(text) : notFound();
      },
    },
  ];
}

export function mapDownloadInterceptor({ files, host, info, error }: MapRouteDeps): Interceptor {
  async function serveServerMap(request: Request, id: string, context: ContextWithFetch): Promise<Response | null> {
    if (!id) return null;
    if (files.isFastLoading()) {
      const saved = await files.readSaved(id);
      if (saved) {
        info(TEXT.fastLoad(id, files.savedFileOf(id)));
        return new Response(saved, { headers: { [CONTENT_TYPE_HEADER]: textResponse('').headers.get(CONTENT_TYPE_HEADER) ?? '' } });
      }
    }
    if (!context.fetch) return null;
    const response = await context.fetch(request);
    if (!response.ok) return response;
    const text = await response.text();
    files.save(id, text).catch((saveError: unknown) => {
      if (!text.startsWith(MAP_MARKER.notPublished)) error(TEXT.saveFailed(id, (saveError as Error).message));
    });
    return new Response(text, { status: response.status, headers: { [CONTENT_TYPE_HEADER]: response.headers.get(CONTENT_TYPE_HEADER) || (textResponse('').headers.get(CONTENT_TYPE_HEADER) ?? '') } });
  }

  return async (request, url, context) => {
    const isMapDownload = url.hostname === host && url.pathname === SERVER_SCRIPT_PATH && request.method === HTTP_METHOD.post;
    if (!isMapDownload) return null;
    const body = new URLSearchParams(await request.clone().text());
    if (body.get(MAP_REQUEST.field) !== MAP_REQUEST.value) return null;
    const id = (body.get(MAP_REQUEST.id) ?? '').trim();
    if (!isLocalMapId(id)) return serveServerMap(request, id, context);
    const file = await files.findLocal(localNameOf(id));
    if (!file) {
      error(TEXT.localMissing(id, files.dir));
      return new Response(NOT_PUBLISHED_ANSWER(MAP_MARKER.notPublished));
    }
    info(TEXT.servingLocal(id, file));
    return textResponse(await files.readLocal(file));
  };
}

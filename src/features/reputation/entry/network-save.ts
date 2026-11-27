import { HTTP_METHOD } from '#wrapper/http/keys.ts';
import type { Interceptor, RequestContext } from '#wrapper/feature-types.ts';
import { SAVE_REQUEST, SERVER_SCRIPT_PATH } from '../keys.ts';
import { saveValuesOf } from '../domain/device.ts';
import type { SaveWatch } from '../services/save-watch.ts';

type ContextWithFetch = RequestContext & { fetch?: (request: Request) => Promise<Response> };
export type NetworkSaveDeps = Readonly<{ watch: SaveWatch; hosts: readonly string[]; clock: () => number; isOn: () => boolean }>;

export function networkSaveInterceptor({ watch, hosts, clock, isOn }: NetworkSaveDeps): Interceptor {
  return async (request, url, context: ContextWithFetch) => {
    const isServerScript = request.method === HTTP_METHOD.post && hosts.includes(url.hostname) && url.pathname.endsWith(SERVER_SCRIPT_PATH);
    if (!isServerScript || !isOn()) return null;
    const body = new URLSearchParams(await request.clone().text());
    const kind = body.get(SAVE_REQUEST.kind);
    const login = body.get(SAVE_REQUEST.login) ?? '';
    if (kind === SAVE_REQUEST.save) {
      watch.upload({ at: clock(), login, ...saveValuesOf(body.get(SAVE_REQUEST.text) ?? '') });
      return null;
    }
    if (kind !== SAVE_REQUEST.load || !context.fetch) return null;
    const response = await context.fetch(request);
    const text = await response.text();
    if (response.ok) watch.load({ at: clock(), login, ...saveValuesOf(text) });
    return new Response(text, { status: response.status, statusText: response.statusText, headers: response.headers });
  };
}

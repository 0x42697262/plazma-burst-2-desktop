import { ROUTE_NAME } from '#shared/contract/keys.ts';
import { HTTP_METHOD, STATUS } from '#wrapper/http/keys.ts';
import { errorResponse, jsonResponse } from '#wrapper/http/responses.ts';
import type { DevRoute, RequestContext } from '#wrapper/feature-types.ts';
import { SAVE_SOURCE } from '#kernel/game-save/keys.ts';
import { saveValuesOf } from '#kernel/game-save/save-text.ts';
import { ACTION, CONTENT_TYPE_HEADER, FORM_TYPE, SAVE_REQUEST, SERVER_SCRIPT_PATH } from '../keys.ts';
import { REQUEST_TEXT, ROUTE_TEXT } from '../text.ts';
import type { SaveWatch } from '../services/save-watch.ts';

type ContextWithFetch = RequestContext & { fetch?: (request: Request) => Promise<Response> };
type Action = (typeof ACTION)[keyof typeof ACTION];
type Asked = Readonly<{ action: Action; url: string; login: string; password: string; text: string }>;
export type RequestDeps = Readonly<{ watch: SaveWatch; hosts: readonly string[]; clock: () => number; isAllowed: (action: Action) => boolean }>;

function askedOf(body: unknown): Asked | null {
  if (!body || typeof body !== 'object') return null;
  const asked = body as Record<string, unknown>;
  const isAction = asked.action === ACTION.load || asked.action === ACTION.save;
  const texts = [asked.url, asked.login, asked.password].every((value) => typeof value === 'string');
  if (!isAction || !texts || (asked.action === ACTION.save && typeof asked.text !== 'string')) return null;
  return { action: asked.action as Action, url: asked.url as string, login: asked.login as string, password: asked.password as string, text: typeof asked.text === 'string' ? asked.text : '' };
}

function isSaveAddress(text: string, hosts: readonly string[]): boolean {
  try {
    const url = new URL(text);
    return hosts.includes(url.hostname) && url.pathname.endsWith(SERVER_SCRIPT_PATH);
  } catch {
    return false;
  }
}

export function requestRoutes({ watch, hosts, clock, isAllowed }: RequestDeps): DevRoute[] {
  async function handle(request: Request, _url: URL, context: ContextWithFetch): Promise<Response> {
    if (context.remote) return errorResponse(ROUTE_TEXT.notInRemotePlay, STATUS.forbidden);
    if (request.method !== HTTP_METHOD.post || !context.fetch) return errorResponse(REQUEST_TEXT.badRequest, STATUS.badRequest);
    let asked: Asked | null;
    try {
      asked = askedOf(await request.json());
    } catch {
      asked = null;
    }
    if (!asked) return errorResponse(REQUEST_TEXT.badRequest, STATUS.badRequest);
    if (!isAllowed(asked.action)) return errorResponse(REQUEST_TEXT.notAllowed(asked.action), STATUS.forbidden);
    if (!isSaveAddress(asked.url, hosts)) return errorResponse(REQUEST_TEXT.notTheSaveAddress(asked.url), STATUS.badRequest);
    if (!asked.login) return errorResponse(REQUEST_TEXT.noLogin, STATUS.badRequest);
    const form: Record<string, string> = { [SAVE_REQUEST.kind]: asked.action, [SAVE_REQUEST.login]: asked.login, [SAVE_REQUEST.password]: asked.password };
    if (asked.action === ACTION.save) form[SAVE_REQUEST.text] = asked.text;
    let answer: Response;
    try {
      answer = await context.fetch(new Request(asked.url, { method: HTTP_METHOD.post, headers: { [CONTENT_TYPE_HEADER]: FORM_TYPE }, body: new URLSearchParams(form) }));
    } catch (error) {
      return errorResponse(REQUEST_TEXT.failed((error as Error).message), STATUS.badGateway);
    }
    const text = await answer.text();
    const seen = { at: clock(), login: asked.login, source: SAVE_SOURCE.console, ...saveValuesOf(asked.action === ACTION.save ? asked.text : text) };
    if (asked.action === ACTION.save) watch.upload(seen);
    else if (answer.ok) watch.load(seen);
    return jsonResponse({ status: answer.status, text: asked.action === ACTION.load ? text : '' });
  }
  return [{ name: ROUTE_NAME.netsave, handle }];
}

import {
  BODY_END, BODY_END_TAG, ESCAPED_LESS_THAN, FIRST_SCRIPT, FLASH_SCRIPT_TAG, JOIN_PAGE_GLOBAL, MAIN_SCRIPT_TAG, PAGE_GLOBAL_SCRIPT, SCRIPT_END_ESCAPE,
  SERVER_PAGE_GLOBAL, SERVER_TRACE_SCRIPT_TAG, TRACE_SCRIPT_TAG,
} from './keys.ts';
import { INDEX_TEXT as TEXT } from './text.ts';

export type JoinPage = { hostPort: string; nickname?: string; password?: string };
export type IndexOptions = {
  hooks: ((html: string) => string) | null;
  devScripts: string | null;
  join: JoinPage | null;
  serverPage: unknown;
  remoteScript: string | null;
  remoteNotMarked: string;
  verbose: boolean;
  isServer: boolean;
};
export type PreparedIndex = { html: string | null; errors: string[]; warnings: string[] };

const asScriptJson = (value: unknown): string => JSON.stringify(value).replace(SCRIPT_END_ESCAPE, ESCAPED_LESS_THAN);

export const pageGlobalScript = (name: string, value: unknown): string => PAGE_GLOBAL_SCRIPT(name, asScriptJson(value));
export const serverPageScript = (config: unknown): string => pageGlobalScript(SERVER_PAGE_GLOBAL, config);
export const joinPageScript = (join: JoinPage): string => pageGlobalScript(JOIN_PAGE_GLOBAL, { address: join.hostPort, nickname: join.nickname, password: join.password });

const beforeFirstScript = (html: string, script: string): string | null => {
  const at = html.search(FIRST_SCRIPT);
  return at < 0 ? null : html.slice(0, at) + script + html.slice(at);
};

export function prepareIndex(source: string, options: IndexOptions): PreparedIndex {
  const errors: string[] = [];
  const warnings: string[] = [];
  const refused = (message: string): PreparedIndex => ({ html: null, errors: [...errors, message], warnings });
  let html = options.hooks ? options.hooks(source) : source;
  if (options.devScripts !== null) {
    const before = html;
    html = html.includes(MAIN_SCRIPT_TAG) ? html.replace(MAIN_SCRIPT_TAG, MAIN_SCRIPT_TAG + options.devScripts) : html.replace(BODY_END, options.devScripts + BODY_END_TAG);
    if (html === before) errors.push(TEXT.devNotInjected);
  }
  if (options.join && !options.remoteScript && !options.isServer) {
    const joined = beforeFirstScript(html, joinPageScript(options.join));
    if (joined === null) return refused(TEXT.joinNotPrepared);
    html = joined;
  }
  if (options.isServer) {
    const hosted = html.includes(FLASH_SCRIPT_TAG) ? beforeFirstScript(html, serverPageScript(options.serverPage)) : null;
    if (hosted === null) return refused(TEXT.hostNotPrepared);
    html = hosted.replace(FLASH_SCRIPT_TAG, FLASH_SCRIPT_TAG + SERVER_TRACE_SCRIPT_TAG);
  } else if (options.verbose) {
    if (html.includes(FLASH_SCRIPT_TAG)) html = html.replace(FLASH_SCRIPT_TAG, FLASH_SCRIPT_TAG + TRACE_SCRIPT_TAG);
    else warnings.push(TEXT.traceSilent);
  }
  if (options.remoteScript) {
    const marked = beforeFirstScript(html, options.remoteScript);
    if (marked === null) return refused(options.remoteNotMarked);
    html = marked;
  }
  return { html, errors, warnings };
}

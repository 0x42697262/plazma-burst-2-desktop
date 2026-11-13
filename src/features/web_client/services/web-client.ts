import fs from 'node:fs';
import path from 'node:path';
import type http from 'node:http';
import type { Logger } from '#kernel/log/logger.ts';
import { PAGE_CORE_FILE } from '#kernel/config/paths.ts';
import { prepareIndex } from '#wrapper/platform/index-page.ts';
import { moduleScriptTag, scriptTag } from '#wrapper/platform/keys.ts';
import type { HttpHandler } from '#server/feature-types.ts';
import { BAD_REQUEST, MAX_FORM_BYTES, NOT_FOUND, OK, PAYLOAD_TOO_LARGE, SEE_OTHER, UNAVAILABLE } from '../constants.ts';
import {
  CACHE_GAME_FILES, GAME_POLICY, GET_METHOD, HEADER, HTML_TYPE, INDEX_FILE, JOIN_PAGE_HTML, JOIN_POLICY, NO_REFERRER, NO_SNIFF, NO_STORE, POST_METHOD, ROUTE,
  SCRIPT_TYPE, SERVER_NAME_MARK, TEXT_ENCODING, TEXT_TYPE, URL_BASE, ERROR_JOIN,
} from '../keys.ts';
import { TEXT } from '../text.ts';
import { contentTypeOf, escapeHtml, lobbyHostOf, readJoinForm, safeRelativePath } from '../domain/web.ts';

export type WebClientOptions = Readonly<{
  gameDir: string;
  pageDir: string;
  namesScript: string;
  serverName: string;
  publicUrl: string;
  log: Logger;
}>;

type Response = http.ServerResponse;

const safeHeaders = (contentType: string, cache: string, policy: string | null = null): http.OutgoingHttpHeaders => ({
  [HEADER.contentType]: contentType,
  [HEADER.cache]: cache,
  [HEADER.noSniff]: NO_SNIFF,
  [HEADER.referrer]: NO_REFERRER,
  ...(policy ? { [HEADER.policy]: policy } : {}),
});

function send(response: Response, status: number, body: string, headers: http.OutgoingHttpHeaders): void {
  response.writeHead(status, headers);
  response.end(body);
}

function sendFile(response: Response, file: string, cache: string): void {
  fs.stat(file, (error, stats) => {
    if (error || !stats.isFile()) {
      send(response, NOT_FOUND, TEXT.notFound, safeHeaders(TEXT_TYPE, NO_STORE));
      return;
    }
    response.writeHead(OK, safeHeaders(contentTypeOf(file), cache));
    fs.createReadStream(file).pipe(response);
  });
}

function readBody(request: http.IncomingMessage, limit: number): Promise<string | null> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let size = 0;
    request.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        resolve(null);
        request.destroy();
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => { resolve(Buffer.concat(chunks).toString(TEXT_ENCODING)); });
    request.on('error', () => { resolve(null); });
  });
}

export function createWebClient(options: WebClientOptions): HttpHandler {
  const { gameDir, pageDir, namesScript, serverName, publicUrl, log } = options;
  const hasPageBundle = fs.existsSync(path.join(pageDir, PAGE_CORE_FILE));
  if (!hasPageBundle) log.warn(TEXT.notBuilt(pageDir));
  if (publicUrl) log.info(TEXT.ready(publicUrl));
  const gameIndex = fs.readFileSync(path.join(gameDir, INDEX_FILE), TEXT_ENCODING);
  const joinPage = JOIN_PAGE_HTML.split(SERVER_NAME_MARK).join(escapeHtml(serverName));
  const pageScripts = scriptTag(ROUTE.devPrefix + ROUTE.names) + moduleScriptTag(ROUTE.devPrefix + ROUTE.page + PAGE_CORE_FILE);

  async function play(request: http.IncomingMessage, response: Response): Promise<void> {
    const body = await readBody(request, MAX_FORM_BYTES);
    if (body === null) {
      send(response, PAYLOAD_TOO_LARGE, TEXT.tooLong, safeHeaders(TEXT_TYPE, NO_STORE));
      return;
    }
    const { form, problem } = readJoinForm(body);
    if (!form) {
      send(response, BAD_REQUEST, problem ?? '', safeHeaders(TEXT_TYPE, NO_STORE));
      return;
    }
    if (!hasPageBundle) {
      send(response, UNAVAILABLE, TEXT.noPageBundle, safeHeaders(TEXT_TYPE, NO_STORE));
      return;
    }
    const join = { hostPort: lobbyHostOf(publicUrl, request.headers[HEADER.host]), nickname: form.nickname, password: form.password };
    const prepared = prepareIndex(gameIndex, {
      hooks: null, pageScripts, join, serverPage: null, remoteScript: null, remoteNotMarked: '', verbose: false, isServer: false,
    });
    for (const error of prepared.errors) log.error(error);
    if (prepared.html === null) {
      send(response, UNAVAILABLE, prepared.errors.join(ERROR_JOIN), safeHeaders(TEXT_TYPE, NO_STORE));
      return;
    }
    send(response, OK, prepared.html, safeHeaders(HTML_TYPE, NO_STORE, GAME_POLICY));
  }

  function serveUnderPlay(rest: string, response: Response): void {
    if (rest.startsWith(ROUTE.devPrefix)) {
      const devPath = rest.slice(ROUTE.devPrefix.length);
      if (devPath === ROUTE.names) {
        send(response, OK, namesScript, safeHeaders(SCRIPT_TYPE, NO_STORE));
        return;
      }
      const pagePath = devPath.startsWith(ROUTE.page) ? safeRelativePath(devPath.slice(ROUTE.page.length)) : null;
      if (pagePath) sendFile(response, path.join(pageDir, pagePath), NO_STORE);
      else send(response, NOT_FOUND, TEXT.notFound, safeHeaders(TEXT_TYPE, NO_STORE));
      return;
    }
    const gamePath = safeRelativePath(rest);
    if (gamePath && gamePath !== INDEX_FILE) sendFile(response, path.join(gameDir, gamePath), CACHE_GAME_FILES);
    else send(response, NOT_FOUND, TEXT.notFound, safeHeaders(TEXT_TYPE, NO_STORE));
  }

  return (request, response) => {
    const pathname = new URL(request.url ?? ROUTE.join, URL_BASE).pathname;
    if (pathname === ROUTE.join && request.method === GET_METHOD) {
      send(response, OK, joinPage, safeHeaders(HTML_TYPE, NO_STORE, JOIN_POLICY));
      return true;
    }
    if (!pathname.startsWith(ROUTE.play)) return false;
    const rest = pathname.slice(ROUTE.play.length);
    if (rest === '' && request.method === POST_METHOD) {
      void play(request, response);
      return true;
    }
    if (rest === '') {
      response.writeHead(SEE_OTHER, { [HEADER.location]: ROUTE.join });
      response.end();
      return true;
    }
    serveUnderPlay(rest, response);
    return true;
  };
}

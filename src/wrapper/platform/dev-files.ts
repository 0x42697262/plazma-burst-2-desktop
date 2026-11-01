import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import type { Logger } from '#kernel/log/logger.ts';
import { ROUTE_NAME } from '#shared/contract/keys.ts';
import type { RequestContext } from '../feature-types.ts';
import { BAD_REQUEST, CONFLICT, NOT_FOUND } from './constants.ts';
import { JSON_TYPE, NAMES_FALLBACK, NAMES_NOT_FOUND, NAMES_VERSION, OK_BODY, OPCODES_FALLBACK, PARENT_FOLDER, PUT_METHOD, SCRIPT_TYPE, TEXT_ENCODING } from './keys.ts';
import { FILES_TEXT as TEXT } from './text.ts';
import { contentTypeOf } from './game-files.ts';
import { textResponse, typedResponse } from './responses.ts';
import type { PageContext } from './context.ts';

export type DevRouter = (name: string, request: Request, url: URL, context: RequestContext) => Promise<Response | null>;
export type DevFiles = { pageDir: string; namesFile: string; opcodesFile: string; consoleOn: boolean; router: DevRouter };

const isPlainObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

async function scriptOr(file: string, fallback: string): Promise<Response> {
  try {
    return typedResponse(await fs.readFile(file), SCRIPT_TYPE, false);
  } catch {
    return typedResponse(fallback, SCRIPT_TYPE, false);
  }
}

export function createDevFiles({ pageDir, namesFile, opcodesFile, consoleOn, router }: DevFiles) {
  async function servePageFile(relative: string): Promise<Response | null> {
    const file = path.resolve(pageDir, relative);
    const type = contentTypeOf(file);
    if (path.relative(pageDir, file).startsWith(PARENT_FOLDER) || !type) return null;
    try {
      return typedResponse(await fs.readFile(file), type, false);
    } catch {
      return textResponse(TEXT.notFound, NOT_FOUND);
    }
  }

  async function serveSettings(request: Request, context: PageContext): Promise<Response> {
    const kvFile = context.kvFile;
    if (!kvFile) return textResponse(TEXT.notFound, NOT_FOUND);
    if (request.method !== PUT_METHOD) return typedResponse(await kvFile.read(), JSON_TYPE, false);
    let saved: unknown;
    try {
      saved = JSON.parse(await request.text());
    } catch {
      return textResponse(TEXT.invalidJson, BAD_REQUEST);
    }
    if (!isPlainObject(saved)) return textResponse(TEXT.expectedObject, BAD_REQUEST);
    if (!(await kvFile.write(saved))) return textResponse(TEXT.editedElsewhere, CONFLICT);
    return new Response(OK_BODY);
  }

  return async function serveDev(name: string, request: Request, url: URL, context: PageContext): Promise<Response> {
    const routed = await router(name, request, url, context);
    if (routed) return routed;
    if (name.startsWith(ROUTE_NAME.page)) {
      const served = await servePageFile(name.slice(ROUTE_NAME.page.length));
      if (served) return served;
    }
    if (name === ROUTE_NAME.names) return scriptOr(namesFile, NAMES_FALLBACK);
    if (consoleOn && name === ROUTE_NAME.opcodes) return scriptOr(opcodesFile, OPCODES_FALLBACK);
    if (consoleOn && name === ROUTE_NAME.kv) return serveSettings(request, context);
    return textResponse(TEXT.notFound, NOT_FOUND);
  };
}

export function checkNamesFile({ namesFile, repoRoot, gameVersion, runFlag, log }: { namesFile: string; repoRoot: string; gameVersion: string | null; runFlag: string; log: Logger }): void {
  const findNames = TEXT.findNames(runFlag);
  let text: string;
  try {
    text = fsSync.readFileSync(namesFile, TEXT_ENCODING);
  } catch {
    log.error(TEXT.namesMissing(path.relative(repoRoot, namesFile), findNames));
    return;
  }
  const namesVersion = NAMES_VERSION.exec(text)?.[1];
  if (namesVersion && namesVersion !== gameVersion) log.error(TEXT.namesOtherVersion(namesVersion, gameVersion ?? '', findNames));
  if (NAMES_NOT_FOUND.test(text)) log.error(TEXT.namesIncomplete);
}

export function checkPageBundle({ pageDir, entries, log }: { pageDir: string; entries: readonly string[]; log: Logger }): void {
  if (!entries.every((entry) => fsSync.existsSync(path.join(pageDir, entry)))) log.error(TEXT.pageBundleMissing);
}

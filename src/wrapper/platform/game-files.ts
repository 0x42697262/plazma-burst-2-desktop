import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import type { Logger } from '#kernel/log/logger.ts';
import { FORBIDDEN, NOT_FOUND, OK } from './constants.ts';
import {
  ASSET_VERSION_FILE, BINARY_TYPE, CONTENT_TYPES, CONTENT_TYPE_HEADER, FOLDER_END, HTML_CONTENT, HTML_FILE, KEPT_FILE, LINE_END, LINES, TEXT_ENCODING, VERSION_FILE,
} from './keys.ts';
import { FILES_TEXT as TEXT } from './text.ts';
import { textResponse } from './responses.ts';

export type RequestFetch = (request: Request | string) => Promise<Response>;
type VersionFile = { version?: string; build?: string };

const readVersionFile = (root: string): VersionFile => JSON.parse(fsSync.readFileSync(path.join(root, VERSION_FILE), TEXT_ENCODING)) as VersionFile;

export function readGameVersion(root: string, override: string | null): string | null {
  if (override) return override;
  try {
    return readVersionFile(root).version ?? null;
  } catch {
    return null;
  }
}

export const contentTypeOf = (file: string): string | undefined => CONTENT_TYPES[path.extname(file)];

export function createGameFiles({ root, log, keepMissing }: { root: string; log: Logger; keepMissing: boolean }) {
  const keptFile = path.join(root, KEPT_FILE);
  let keptList: Set<string> | null = null;

  async function noteKept(file: string): Promise<void> {
    const relative = path.relative(root, file).split(path.sep).join(FOLDER_END);
    if (!keptList) {
      try {
        keptList = new Set((await fs.readFile(keptFile, TEXT_ENCODING)).split(LINES).filter(Boolean));
      } catch {
        keptList = new Set();
      }
    }
    if (keptList.has(relative)) return;
    keptList.add(relative);
    await fs.appendFile(keptFile, relative + LINE_END);
  }

  async function fetchAndKeep(url: URL, file: string, fetchFromSite: RequestFetch): Promise<Response> {
    let response: Response;
    try {
      response = await fetchFromSite(url.href);
    } catch (error) {
      return textResponse(TEXT.notFoundBecause((error as Error).message), NOT_FOUND);
    }
    const type = response.headers.get(CONTENT_TYPE_HEADER) || '';
    const isSitePage = HTML_CONTENT.test(type) && !HTML_FILE.test(file);
    if (!response.ok || isSitePage) return textResponse(TEXT.notFound, NOT_FOUND);
    const data = Buffer.from(await response.arrayBuffer());
    try {
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, data);
      await noteKept(file);
      log.debug(TEXT.kept(path.relative(root, file), data.length));
    } catch (error) {
      log.warn(TEXT.notKept(file, (error as Error).message));
    }
    return new Response(data, { status: OK, headers: { [CONTENT_TYPE_HEADER]: type || contentTypeOf(file) || BINARY_TYPE } });
  }

  async function serveFile(relative: string, url: URL, fetchFromSite: RequestFetch): Promise<Response> {
    const file = path.join(root, path.normalize(relative));
    if (!file.startsWith(root + path.sep)) return textResponse(TEXT.forbidden, FORBIDDEN);
    try {
      const data = await fs.readFile(file);
      return new Response(data, { status: OK, headers: { [CONTENT_TYPE_HEADER]: contentTypeOf(file) || BINARY_TYPE } });
    } catch {
      return keepMissing ? fetchAndKeep(url, file, fetchFromSite) : textResponse(TEXT.notFound, NOT_FOUND);
    }
  }

  return { serveFile };
}

export async function checkSadburstBuild({ root, site, prefix, log, fetchLive }: { root: string; site: string; prefix: string; log: Logger; fetchLive: (url: string) => Promise<Response> }): Promise<void> {
  try {
    const local = readVersionFile(root).build;
    const response = await fetchLive(site + prefix + ASSET_VERSION_FILE);
    const live = response.ok ? (await response.text()).trim().split(LINES)[0] : null;
    if (live && local && live !== local) log.warn(TEXT.newerBuild(live, local));
  } catch {
    return;
  }
}

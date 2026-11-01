import fs from 'node:fs';
import path from 'node:path';
import { NOT_PUBLISHED, beautifyMap } from '#kernel/maps/map-text.ts';
import { stringOf } from '#kernel/text/text-of.ts';
import { HEX_DIGITS, HEX_RADIX, MAP_TIMEOUT_MS } from './constants.ts';
import {
  BYTE_ORDER_MARK, ESCAPED_CHARACTER, ESCAPE_MARK, HIDDEN_FILE, LOCAL_PREFIX, MAP_EXTENSIONS, MAP_FILE_EXTENSION, MAP_FILE_SUFFIX, MAP_REQUEST,
  PATH_SEPARATORS, POST_METHOD, SITE_MAPS, TEXT_ENCODING, UNSAFE_CHARACTER, XML_START, ZERO_PAD,
} from './keys.ts';
import { MAPS_TEXT as TEXT } from './text.ts';

export type Maps = { list(): string[]; local(id: unknown): string | null; download(id: string): Promise<string | null> };
type Fetch = (url: string, init: RequestInit) => Promise<Response>;

export const fileName = (id: string): string => id.replace(UNSAFE_CHARACTER, (character) => ESCAPE_MARK + character.charCodeAt(0).toString(HEX_RADIX).padStart(HEX_DIGITS, ZERO_PAD)) + MAP_FILE_EXTENSION;
export const idOf = (file: string): string => file.replace(MAP_FILE_SUFFIX, '').replace(ESCAPED_CHARACTER, (_match, hex: string) => String.fromCharCode(parseInt(hex, HEX_RADIX)));

const baseName = (id: string): string => fileName(id).slice(0, -MAP_FILE_EXTENSION.length);

function readIn(folder: string, name: string): string | null {
  let files: string[];
  try {
    files = fs.readdirSync(folder);
  } catch {
    return null;
  }
  const wanted = name.toLowerCase();
  for (const extension of MAP_EXTENSIONS) {
    const hit = files.find((file) => file.toLowerCase() === wanted + extension && !file.startsWith(HIDDEN_FILE));
    if (hit) return fs.readFileSync(path.join(folder, hit), TEXT_ENCODING).replace(BYTE_ORDER_MARK, '').trim();
  }
  return null;
}

function mapFiles(folder: string): string[] {
  try {
    return fs.readdirSync(folder).filter((file) => !file.startsWith(HIDDEN_FILE) && MAP_EXTENSIONS.includes(path.extname(file).toLowerCase()));
  } catch {
    return [];
  }
}

function keep(cacheDir: string, id: string, xml: string): void {
  try {
    fs.mkdirSync(cacheDir, { recursive: true });
    fs.writeFileSync(path.join(cacheDir, fileName(id)), xml);
  } catch {
    return;
  }
}

export function createMaps({ mapsDir, cacheDir, unpack, fetch = globalThis.fetch }: { mapsDir: string; cacheDir: string; unpack: (text: string) => string; fetch?: Fetch }): Maps {
  const plain = (text: string | null): string | null => (text === null ? null : unpack(text));
  return {
    list: () => [...new Set([...mapFiles(mapsDir), ...mapFiles(cacheDir)].map(idOf))],
    local(id) {
      const wanted = stringOf(id || '').trim();
      const isUnsafe = !wanted || PATH_SEPARATORS.some((separator) => wanted.includes(separator)) || wanted.startsWith(HIDDEN_FILE);
      if (isUnsafe) return null;
      const name = wanted.toLowerCase().startsWith(LOCAL_PREFIX) ? wanted.slice(LOCAL_PREFIX.length) : wanted;
      return plain(readIn(mapsDir, name) || readIn(mapsDir, baseName(wanted)) || readIn(cacheDir, baseName(wanted)));
    },
    async download(id) {
      const body = new URLSearchParams({ ...MAP_REQUEST, cmap: id });
      const response = await fetch(SITE_MAPS, { method: POST_METHOD, body, signal: AbortSignal.timeout(MAP_TIMEOUT_MS) });
      if (!response.ok) throw new Error(TEXT.siteAnswered(response.status));
      const text = (await response.text()).replace(BYTE_ORDER_MARK, '').trim();
      if (!text.startsWith(XML_START) || text.startsWith(NOT_PUBLISHED)) return null;
      const xml = beautifyMap(unpack(text));
      keep(cacheDir, id, xml);
      return xml;
    },
  };
}

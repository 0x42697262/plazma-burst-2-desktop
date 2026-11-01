import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { MAP_MARKER } from '#shared/contract/keys.ts';
import { stringOf } from '#kernel/text/text-of.ts';
import { DECOMPRESSOR, LINE_END, QUOTE, STRINGS_FILE, TAG_START, TEXT_ENCODING, XML_SCRIPT } from './keys.ts';
import { TEXT } from './text.ts';

export const COMPRESSED = MAP_MARKER.compressedPrefix;
export const NOT_PUBLISHED = MAP_MARKER.notPublished;

type Unpack = (text: string) => string;

export const isCompressed = (text: unknown): boolean => stringOf(text).startsWith(COMPRESSED);

function loadUnpacker(gameDir: string): Unpack {
  const sandbox: Record<string, unknown> = {};
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(gameDir, STRINGS_FILE), TEXT_ENCODING), sandbox);
  const source = fs.readFileSync(path.join(gameDir, ...XML_SCRIPT), TEXT_ENCODING);
  vm.runInContext(source, sandbox);
  const name = DECOMPRESSOR.exec(source)?.[1];
  if (!name) throw new Error(TEXT.noDecompressor);
  return vm.runInContext(name, sandbox) as Unpack;
}

export function makeUnpacker(gameDir: string): Unpack {
  let unpack: Unpack | null = null;
  return (text) => {
    if (!isCompressed(text)) return text;
    unpack ??= loadUnpacker(gameDir);
    const unpacked = unpack(text);
    if (isCompressed(unpacked)) throw new Error(TEXT.stillCompressed);
    return unpacked;
  };
}

export function beautifyMap(text: string): string {
  const lines: string[] = [];
  let line = '';
  let quoted = false;
  for (const character of text) {
    if (quoted) {
      line += character;
      if (character === QUOTE) quoted = false;
      continue;
    }
    if (character === TAG_START && line.trim()) {
      lines.push(line.trim());
      line = '';
    }
    line += character;
    if (character === QUOTE) quoted = true;
  }
  if (line.trim()) lines.push(line.trim());
  return lines.length ? lines.join(LINE_END) + LINE_END : '';
}

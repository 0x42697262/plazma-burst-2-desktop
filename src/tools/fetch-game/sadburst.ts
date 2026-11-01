import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import type { GameClient } from '#kernel/config/clients.ts';
import { stringsOf } from '../find-names/find-names.ts';
import { BYTES_PER_MEGABYTE, FRAME_DIGITS, JOBS, JSON_INDENT, MAX_FRAMES, MEGABYTE_DECIMALS, PROGRESS_EVERY } from './constants.ts';
import {
  ABSOLUTE_REFERENCE, ASSET_IN_CODE, CAMPAIGN_LIST, COMMENT_LINE, CURRENT_FOLDER, DOWNLOAD_SUFFIX, FLASH_EXPORT, HTML_REFERENCE, INDEX_FILE, JS_EXTENSION, KEPT,
  LANGUAGE_DEFAULT, LINES, LINE_END, MANIFEST, MODULE_REFERENCE, OGG_OVERRIDE, OUTSIDE_PATH, PARENT_FOLDER, PREVIOUS_SUFFIX, RELATIVE_ASSET, SADBURST_VERSION,
  SCRIPT_FILE, SKINS_LIST, SLASH, SOUNDS_LIST, SOUND_SOURCE, SPRITE_LOADER, STRING_PREFIX, STRING_TOKEN, TEXT_ENCODING, TEXT_FILE, VERSION_FILE, VERSION_JSON,
  ZERO, campaignLevel, oggOverride, skinFile, spriteFrame, spriteSheet,
} from './keys.ts';
import { TEXT } from './text.ts';
import { getSitePage, pool } from './download.ts';

export { MANIFEST, VERSION_FILE, KEPT };

export type Manifest = { strings: Record<string, string>; order: string[] };
export type FetchedSadburst = { out: string; version: string; files: number; bytes: number; problems: string[] };

const megabytes = (bytes: number): string => (bytes / BYTES_PER_MEGABYTE).toFixed(MEGABYTE_DECIMALS);
const normalize = (relative: string): string => path.posix.normalize(relative).replace(CURRENT_FOLDER, '');

export function htmlRefs(text: string): string[] {
  return [...text.matchAll(HTML_REFERENCE)].map((match) => match[1] ?? '').filter((reference) => !ABSOLUTE_REFERENCE.test(reference));
}

export function moduleRefs(text: string): string[] {
  return [...new Set([...text.matchAll(MODULE_REFERENCE)].map((match) => match[1] ?? ''))];
}

export function manifestFiles(manifest: unknown): string[] {
  const candidate = manifest as Partial<Manifest> | null;
  if (!candidate || !Array.isArray(candidate.order) || !candidate.strings?.[LANGUAGE_DEFAULT]) throw new Error(TEXT.notManifest(MANIFEST));
  return [...new Set([...Object.values(candidate.strings), ...candidate.order])];
}

export function loadStrings(text: string): Map<string, string> {
  const sandbox: Record<string, unknown> = {};
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(text, sandbox);
  return stringsOf(sandbox);
}

type AssetInput = { texts: readonly (readonly [string, string])[]; strings: ReadonlyMap<string, string>; languages?: readonly string[]; kept?: readonly string[] };

const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
};

export function assetPaths({ texts, strings, languages = [LANGUAGE_DEFAULT], kept = [] }: AssetInput): string[] {
  const found = new Set<string>();
  const allCode = texts.map(([, text]) => text).join(LINE_END);
  const valueOf = (token: string): string | undefined => (token.startsWith(STRING_PREFIX) ? strings.get(token) : token.slice(1, -1));
  for (const match of allCode.matchAll(ASSET_IN_CODE)) found.add(match[1] ?? '');
  for (const value of strings.values()) if (RELATIVE_ASSET.test(value)) found.add(value);
  const decoded = allCode.replace(STRING_TOKEN, (token) => (strings.has(token) ? JSON.stringify(strings.get(token)) : token));
  for (const match of decoded.matchAll(SPRITE_LOADER)) {
    const name = match[1] ?? '';
    for (const file of spriteSheet(name)) found.add(file);
    if (!match[3]) for (let frame = 1; frame <= Number(match[2]) && frame <= MAX_FRAMES; frame++) found.add(spriteFrame(name, String(frame).padStart(FRAME_DIGITS, ZERO)));
  }
  for (const match of decoded.matchAll(OGG_OVERRIDE)) found.add(oggOverride(match[1] ?? ''));
  const listText = (relative: string): string | undefined => texts.find(([listed]) => listed === relative)?.[1];
  const sounds = listText(SOUNDS_LIST);
  if (sounds) {
    for (const match of sounds.matchAll(SOUND_SOURCE)) {
      const value = valueOf(match[1] ?? '');
      if (value) found.add(FLASH_EXPORT + value);
    }
  }
  const skins = parseJson(listText(SKINS_LIST) ?? '');
  if (Array.isArray(skins)) for (const id of skins as string[]) found.add(skinFile(id));
  const campaign = parseJson(listText(CAMPAIGN_LIST) ?? '') as { levels?: string[] } | null;
  for (const level of campaign?.levels ?? []) for (const language of languages) found.add(campaignLevel(language, level));
  for (const line of kept) if (line && !line.startsWith(COMMENT_LINE)) found.add(line.trim());
  return [...found].filter((relative) => relative && !OUTSIDE_PATH.test(relative));
}

function readKept(out: string): string[] {
  try {
    return fs.readFileSync(path.join(out, KEPT), TEXT_ENCODING).split(LINES);
  } catch {
    return [];
  }
}

export async function fetchSadburst(client: GameClient, { out = client.gameDir, jobs = JOBS, say = (line: string) => { console.log(line); } }: { out?: string; jobs?: number; say?: (line: string) => void } = {}): Promise<FetchedSadburst> {
  const base = client.site + client.gamePrefix(null);
  const staging = out + DOWNLOAD_SUFFIX;
  say(TEXT.sadburstHeader(base, out));
  fs.rmSync(staging, { recursive: true, force: true });
  fs.mkdirSync(staging, { recursive: true });
  const saved = new Map<string, Buffer | null>();
  const missing = new Set<string>();
  let bytes = 0;

  async function download(written: string): Promise<Buffer | null> {
    const relative = normalize(written);
    if (relative.startsWith(PARENT_FOLDER) || saved.has(relative) || missing.has(relative)) return saved.get(relative) ?? null;
    saved.set(relative, null);
    const data = await getSitePage(base + relative.split(SLASH).map(encodeURIComponent).join(SLASH));
    if (!data) {
      saved.delete(relative);
      missing.add(relative);
      return null;
    }
    const file = path.join(staging, ...relative.split(SLASH));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, data);
    saved.set(relative, data);
    bytes += data.length;
    return data;
  }

  const index = await getSitePage(base);
  if (!index) throw new Error(TEXT.noGamePage(base));
  fs.writeFileSync(path.join(staging, INDEX_FILE), index);
  saved.set(INDEX_FILE, index);
  const links = htmlRefs(index.toString(TEXT_ENCODING));
  await pool(links, jobs, (link) => download(link));

  const queue = links.filter((link) => SCRIPT_FILE.test(link));
  for (let position = 0; position < queue.length; position++) {
    const script = queue[position] ?? '';
    const data = saved.get(normalize(script));
    if (!data) continue;
    const folder = path.posix.dirname(path.posix.normalize(script));
    for (const reference of moduleRefs(data.toString(TEXT_ENCODING))) {
      const relative = path.posix.join(folder, reference);
      if (saved.has(relative) || missing.has(relative)) continue;
      if ((await download(relative)) && relative.endsWith(JS_EXTENSION)) queue.push(relative);
    }
  }

  const versionText = (await download(VERSION_FILE))?.toString(TEXT_ENCODING).trim().split(LINES) ?? [];
  const manifestData = await download(MANIFEST);
  if (!manifestData) throw new Error(TEXT.manifestMissing(base + MANIFEST));
  const manifest = JSON.parse(manifestData.toString(TEXT_ENCODING)) as Manifest;
  const scripts = manifestFiles(manifest);
  await pool(scripts, jobs, (file) => download(file));

  await pool([SOUNDS_LIST, SKINS_LIST, CAMPAIGN_LIST], jobs, (file) => download(file));
  const textOf = (relative: string): string | null => saved.get(relative)?.toString(TEXT_ENCODING) ?? null;
  const texts = [...saved.keys()].filter((relative) => TEXT_FILE.test(relative) && saved.get(relative)).map((relative) => [relative, textOf(relative) ?? ''] as const);
  const kept = readKept(out);
  const assets = assetPaths({ texts, strings: loadStrings(textOf(manifest.strings[LANGUAGE_DEFAULT] ?? '') || ''), languages: Object.keys(manifest.strings), kept });
  const before = saved.size;
  let done = 0;
  await pool(assets, jobs, async (file) => {
    await download(file);
    if (++done % PROGRESS_EVERY === 0) say(TEXT.assetProgress(done, assets.length, megabytes(bytes)));
  });
  const keptLines = kept.filter(Boolean);
  say(TEXT.assetsDone(saved.size - before, assets.length, keptLines.length, KEPT));
  if (kept.length) fs.writeFileSync(path.join(staging, KEPT), keptLines.join(LINE_END) + LINE_END);

  const problems: string[] = [];
  for (const file of scripts) if (!saved.get(file)) problems.push(TEXT.manifestListsMissing(file));
  for (const link of links) if (missing.has(normalize(link))) problems.push(TEXT.indexLinksMissing(link));
  const build = versionText[0] || null;
  const version = SADBURST_VERSION(build);
  fs.writeFileSync(path.join(staging, VERSION_JSON), JSON.stringify({
    client: client.id,
    version,
    build,
    clientVersion: versionText[1] || null,
    source: base,
    fetched: new Date().toISOString(),
    files: [...saved.values()].filter(Boolean).length,
    bytes,
  }, null, JSON_INDENT) + LINE_END);
  const previous = out + PREVIOUS_SUFFIX;
  if (fs.existsSync(out)) {
    fs.rmSync(previous, { recursive: true, force: true });
    fs.renameSync(out, previous);
    say(TEXT.oldCopyMoved(path.basename(previous)));
  }
  fs.renameSync(staging, out);
  say(TEXT.sadburstDone(version, versionText[1] || TEXT.unknownClientVersion, saved.size, megabytes(bytes), out));
  say(TEXT.keptHint(KEPT));
  return { out, version, files: saved.size, bytes, problems };
}

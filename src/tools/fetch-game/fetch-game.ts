import fs from 'node:fs';
import path from 'node:path';
import { BYTES_PER_MEGABYTE, FILE_PROGRESS_EVERY, JSON_INDENT, MEGABYTE_DECIMALS } from './constants.ts';
import {
  ABSOLUTE_REFERENCE, CSS_REFERENCE, CURRENT_FOLDER, DOWNLOAD_SUFFIX, FLASH_EXPORT_FOLDER, FOLDER_MENTION, HTML_REFERENCE, INDEX_FILE, LATEST_PAGE, LINE_END,
  LISTING_LINK, LISTING_TITLE, PARENT_FOLDER, PARENT_LINK, PREVIOUS_SUFFIX, QUERY_LINK, REQUIRED_FILES, ROOT_LINK, SITE, SLASH, SOUNDS_FOLDER, SOUNDS_LIST,
  SOUNDS_MANIFEST_ENTRY, TEXT_ENCODING, TEXT_EXTENSIONS, URL_MARK, VERSION_JSON, VERSION_LINK, versionBase, CSS_EXTENSION,
} from './keys.ts';
import { TEXT } from './text.ts';
import { getListedFile, pool } from './download.ts';

const megabytes = (bytes: number): string => (bytes / BYTES_PER_MEGABYTE).toFixed(MEGABYTE_DECIMALS);
const normalize = (relative: string): string => path.posix.normalize(relative).replace(CURRENT_FOLDER, '');

export function pageReferences(text: string): string[] {
  const references = [...text.matchAll(HTML_REFERENCE), ...text.matchAll(CSS_REFERENCE)].map((match) => match[1] ?? '');
  return references.filter((reference) => !ABSOLUTE_REFERENCE.test(reference));
}

export function folderCandidates(text: string): Set<string> {
  return new Set([...text.matchAll(FOLDER_MENTION)].map((match) => match[1] ?? ''));
}

export function parseListing(html: string): { files: string[]; dirs: string[] } | null {
  if (!LISTING_TITLE.test(html)) return null;
  const files: string[] = [];
  const dirs: string[] = [];
  for (const match of html.matchAll(LISTING_LINK)) {
    const link = decodeURIComponent(match[1] ?? '');
    const isNavigation = link.startsWith(ROOT_LINK) || link.startsWith(QUERY_LINK) || link.includes(URL_MARK) || link === PARENT_LINK;
    if (isNavigation) continue;
    if (link.endsWith(SLASH)) dirs.push(link.slice(0, -1));
    else files.push(link);
  }
  return { files, dirs };
}

export async function latestVersion(): Promise<string> {
  const html = (await getListedFile(SITE + LATEST_PAGE))?.toString(TEXT_ENCODING) ?? '';
  const version = VERSION_LINK.exec(html)?.[1];
  if (!version) throw new Error(TEXT.noLatestVersion(SITE));
  return version;
}

export type Say = (line: string) => void;
const toTerminal: Say = (line) => { console.log(line); };

export async function fetchOfficial({ version, out, jobs, say = toTerminal }: { version: string; out: string; jobs: number; say?: Say }): Promise<string[]> {
  const base = versionBase(version);
  const staging = out + DOWNLOAD_SUFFIX;
  say(TEXT.header(version, base, out));
  fs.rmSync(staging, { recursive: true, force: true });
  fs.mkdirSync(staging, { recursive: true });
  const saved = new Map<string, number>();
  const missing = new Set<string>();
  const texts: [string, string][] = [];
  let bytes = 0;

  async function download(written: string): Promise<void> {
    const relative = normalize(written);
    if (relative.startsWith(PARENT_FOLDER) || saved.has(relative) || missing.has(relative)) return;
    saved.set(relative, 0);
    const data = await getListedFile(base + relative.split(SLASH).map(encodeURIComponent).join(SLASH));
    if (!data) {
      saved.delete(relative);
      missing.add(relative);
      return;
    }
    const file = path.join(staging, ...relative.split(SLASH));
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, data);
    saved.set(relative, data.length);
    bytes += data.length;
    if (saved.size % FILE_PROGRESS_EVERY === 0) say(TEXT.fileProgress(saved.size, megabytes(bytes)));
    if (TEXT_EXTENSIONS.has(path.extname(relative).toLowerCase())) texts.push([relative, data.toString(TEXT_ENCODING)]);
  }

  await download(INDEX_FILE);
  if (!saved.has(INDEX_FILE)) throw new Error(TEXT.noIndex(base, version));
  const indexReferences = pageReferences(texts[0]?.[1] ?? '');
  await pool(indexReferences, jobs, (reference) => download(reference));
  for (const [relative, text] of texts.slice()) {
    if (!relative.endsWith(CSS_EXTENSION)) continue;
    const folder = path.posix.dirname(relative);
    await pool(pageReferences(text), jobs, (reference) => download(path.posix.join(folder, reference)));
  }

  const probed = new Set<string>();
  const crawlQueue: string[] = [];
  async function crawl(folder: string): Promise<boolean> {
    const html = (await getListedFile(base + folder + SLASH))?.toString(TEXT_ENCODING);
    const listing = html ? parseListing(html) : null;
    if (!listing) return false;
    await pool(listing.files, jobs, (file) => download(folder + SLASH + file));
    for (const inner of listing.dirs) await crawl(folder + SLASH + inner);
    return true;
  }
  let scanned = 0;
  for (;;) {
    for (const reference of indexReferences) if (reference.includes(SLASH)) crawlQueue.push(reference.split(SLASH)[0] ?? '');
    for (; scanned < texts.length; scanned++) for (const folder of folderCandidates(texts[scanned]?.[1] ?? '')) crawlQueue.push(folder);
    const todo = [...new Set(crawlQueue)].filter((folder) => !probed.has(folder));
    crawlQueue.length = 0;
    if (!todo.length) break;
    for (const folder of todo) {
      probed.add(folder);
      if (await crawl(folder)) say(TEXT.crawled(folder));
    }
  }

  const problems: string[] = [];
  for (const reference of indexReferences) if (missing.has(path.posix.normalize(reference))) problems.push(TEXT.indexReferencesMissing(reference));
  for (const needed of REQUIRED_FILES) if (!saved.has(needed)) problems.push(TEXT.requiredMissing(needed));
  const soundsList = texts.find(([relative]) => relative === SOUNDS_LIST);
  if (soundsList) {
    for (const match of soundsList[1].matchAll(SOUNDS_MANIFEST_ENTRY)) {
      const relative = path.posix.join(FLASH_EXPORT_FOLDER, match[1] ?? '');
      if (!saved.has(relative) && !relative.includes(SOUNDS_FOLDER)) problems.push(TEXT.soundsListsMissing(relative));
    }
  } else {
    problems.push(TEXT.noSoundsList);
  }
  if (problems.length) {
    say(TEXT.problems);
    for (const problem of problems) say(TEXT.problem(problem));
  }
  fs.writeFileSync(path.join(staging, VERSION_JSON), JSON.stringify({ version, source: base, fetched: new Date().toISOString(), files: saved.size, bytes }, null, JSON_INDENT) + LINE_END);
  const previous = out + PREVIOUS_SUFFIX;
  if (fs.existsSync(out)) {
    fs.rmSync(previous, { recursive: true, force: true });
    fs.renameSync(out, previous);
    say(TEXT.oldCopyMoved(path.basename(previous)));
  }
  fs.renameSync(staging, out);
  say(TEXT.done(saved.size, megabytes(bytes), out));
  return problems;
}

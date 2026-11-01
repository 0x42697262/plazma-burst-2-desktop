import { MAX_LOOPS } from './constants.ts';
import {
  ATTRIBUTE_MARK, BRANCH_PASS, BRANCH_PATTERN, BRANCH_TAG_PREFIX, BRANCH_TAG_SEPARATOR, BOX_TAG, CHAR, COUNTER_PATTERN, FETCH_CACHE, FRAME_URL, GAME_ID,
  IF_OPEN, LOOP_HEADER, NOT_SPACE, QUOTED_TAG, SCRATCH, SCRATCH_GLOBAL, STRING_TABLE_NAME, WATCHDOG_PATTERN, branchRunName, keptName, loopHeaderPattern, restoreKept, runnableCode,
  saveKept, setKept, tryFinally, watchdogBlock, type BranchPass,
} from './keys.ts';
import { SERVICES_TEXT as TEXT } from './text.ts';

export type Branch = { code: string; counter: string | null };
type BranchTable = Record<string, Branch>;
type Loader = { first: BranchTable; second: BranchTable };
export type GameLoop = { loopVar: string; body: string };
type FoundBranch = { tags: string[]; code: string };
type Span = [number, number];
type Fetcher = (url: string, init: { cache: RequestCache }) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

export { GAME_ID };

let loader: Loader | null = null;
let source: string | null = null;
let watchdog: string | null = null;
let problem: string = TEXT.loaderNotRead;

export const loaderReady = (): boolean => !!loader;
export const loaderSource = (): string | null => source;
export const loaderProblem = (): string => problem;

const globalOf = (name: string): unknown => Reflect.get(globalThis, name);

function stringEnd(src: string, start: number): number {
  const quote = src[start];
  for (let at = start + 1; at < src.length; at++) {
    if (src[at] === CHAR.backslash) {
      at++;
      continue;
    }
    if (quote === CHAR.backtick && src[at] === CHAR.dollar && src[at + 1] === CHAR.open) {
      at = blockEnd(src, at + 1);
      continue;
    }
    if (src[at] === quote) return at;
  }
  return src.length;
}

export function blockEnd(src: string, open: number): number {
  let depth = 0;
  for (let at = open; at < src.length; at++) {
    const character = src[at];
    if (character === CHAR.doubleQuote || character === CHAR.singleQuote || character === CHAR.backtick) {
      at = stringEnd(src, at);
      continue;
    }
    if (character === CHAR.slash && src[at + 1] === CHAR.slash) {
      at = src.indexOf(CHAR.newline, at);
      if (at < 0) return -1;
      continue;
    }
    if (character === CHAR.slash && src[at + 1] === CHAR.star) {
      at = src.indexOf(CHAR.commentEnd, at + CHAR.commentEnd.length) + 1;
      if (at <= 0) return -1;
      continue;
    }
    if (character === CHAR.open) depth++;
    else if (character === CHAR.close && --depth === 0) return at;
  }
  return -1;
}

function tagOf(token: string): string | null {
  const trimmed = token.trim();
  if (QUOTED_TAG.test(trimmed)) return trimmed.slice(1, -1);
  const value = globalOf(trimmed);
  return typeof value === 'string' ? value : null;
}

function branchesIn(src: string, from: number, to: number): FoundBranch[] {
  const found: FoundBranch[] = [];
  BRANCH_PATTERN.lastIndex = from;
  for (let match; (match = BRANCH_PATTERN.exec(src)) && match.index < to;) {
    const open = match.index + match[0].length - 1;
    const end = blockEnd(src, open);
    if (end < 0) break;
    const tags = (match[1] ?? '').split(BRANCH_TAG_SEPARATOR).map((part) => tagOf(part.replace(BRANCH_TAG_PREFIX, ''))).filter((tag): tag is string => !!tag);
    found.push({ tags, code: src.slice(open, end + 1) });
    BRANCH_PATTERN.lastIndex = end + 1;
  }
  return found;
}

function loopAround(src: string, at: number): Span | null {
  const header = src.lastIndexOf(LOOP_HEADER, at);
  if (header < 0) return null;
  const open = src.indexOf(CHAR.open, header);
  const end = blockEnd(src, open);
  return end > at ? [open, end] : null;
}

function nextLoop(src: string, after: number): Span | null {
  const header = src.indexOf(LOOP_HEADER, after);
  if (header < 0) return null;
  const open = src.indexOf(CHAR.open, header);
  const end = blockEnd(src, open);
  return end > 0 ? [open, end] : null;
}

const lastCounter = (code: string): string | null => {
  let counter: string | null = null;
  for (const match of code.matchAll(COUNTER_PATTERN)) counter = match[1] ?? null;
  return counter;
};

export function parseLoader(src: string): Loader {
  const box = branchesIn(src, 0, src.length).find((branch) => branch.tags.length === 1 && branch.tags[0] === BOX_TAG);
  if (!box) throw new Error(TEXT.noBoxBranch);
  let loop = loopAround(src, src.indexOf(box.code));
  if (!loop) throw new Error(TEXT.noFirstLoop);
  const first: BranchTable = {};
  const second: BranchTable = {};
  for (let count = 0; loop && count < MAX_LOOPS; count++, loop = nextLoop(src, loop[1])) {
    const branches = branchesIn(src, loop[0], loop[1]).filter((branch) => branch.tags.length === 1);
    if (!branches.length) break;
    const seenHere = new Set<string>();
    for (const { tags: [tag = ''], code } of branches) {
      if (seenHere.has(tag)) continue;
      seenHere.add(tag);
      const table = first[tag] ? second : first;
      if (!table[tag]) table[tag] = { code, counter: lastCounter(code) };
    }
  }
  return { first, second };
}

export async function readLoader(fetchFn: Fetcher = globalThis.fetch): Promise<boolean> {
  try {
    const response = await fetchFn(FRAME_URL, { cache: FETCH_CACHE });
    if (!response.ok) throw new Error(TEXT.httpStatus(response.status));
    const text = await response.text();
    loader = parseLoader(text);
    source = text;
    watchdog = text.match(WATCHDOG_PATTERN)?.[1] || null;
    problem = '';
  } catch (error) {
    loader = null;
    source = null;
    watchdog = null;
    problem = TEXT.loaderUnreadable((error as Error).message);
  }
  return loaderReady();
}

export const canRebuild = (tag: string): boolean => !!loader?.first[tag]?.counter;
export const canBuild = (tag: string): boolean => !!loader?.first[tag];
export const builtCount = (tag: string): number | null => {
  const counter = loader?.first[tag]?.counter;
  return counter ? globalOf(counter) as number : null;
};

function run(code: string, name: string): void {
  const body = watchdog ? watchdogBlock(watchdog, code) : code;
  (0, eval)(runnableCode(body, name));
}

function runBranch(pass: BranchPass, tag: string, attrs: Readonly<Record<string, string>>, index: number): boolean {
  const branch = (loader as Loader)[pass][tag];
  if (!branch) return false;
  const saved = Object.fromEntries(SCRATCH.map((name) => [name, globalOf(name)]));
  const counter = branch.counter;
  const before = counter ? globalOf(counter) as number : undefined;
  try {
    Reflect.set(globalThis, SCRATCH_GLOBAL.tag, tag);
    Reflect.set(globalThis, SCRATCH_GLOBAL.attrs, Object.fromEntries(Object.entries(attrs).map(([name, value]) => [ATTRIBUTE_MARK + name, value])));
    if (counter) Reflect.set(globalThis, counter, index);
    run(branch.code, branchRunName(pass, tag));
    return !counter || (globalOf(counter) as number) > index;
  } finally {
    if (counter && index < (before as number)) Reflect.set(globalThis, counter, before);
    for (const name of SCRATCH) Reflect.set(globalThis, name, saved[name]);
  }
}

export function buildElement(tag: string, attrs: Readonly<Record<string, string>>, index: number): boolean {
  if (!loader) throw new Error(problem);
  if (!loader.first[tag]) throw new Error(TEXT.noBranch(tag));
  const kept = runBranch(BRANCH_PASS.first, tag, attrs, index);
  if (kept && loader.second[tag]) runBranch(BRANCH_PASS.second, tag, attrs, index);
  return kept;
}

export const branchOf = (tag: string): Branch | null => loader?.first[tag] || null;

export const decoded = (src: string): string => src.replace(STRING_TABLE_NAME,
  (match: string, before: string, name: string) => {
    const value = globalOf(name);
    return typeof value === 'string' ? before + JSON.stringify(value) : match;
  });

export function branchNames(tag: string, patterns: Readonly<Record<string, RegExp>>): Record<string, string> {
  const branch = branchOf(tag);
  if (!branch) return {};
  const code = decoded(branch.code);
  const names: Record<string, string> = {};
  for (const [key, pattern] of Object.entries(patterns)) {
    const match = code.match(pattern);
    if (match) names[key] = match[1] ?? '';
  }
  return names;
}

export function loopAt(src: string, at: number): GameLoop | null {
  if (at < 0) return null;
  const header = loopHeaderPattern();
  let best: GameLoop | null = null;
  for (let match; (match = header.exec(src)) && match.index < at;) {
    const start = match.index + match[0].length;
    let open = start;
    if (src[start] !== CHAR.open) {
      if (!src.slice(start).startsWith(IF_OPEN)) continue;
      let depth = 0;
      let close = start + IF_OPEN.length - 1;
      for (; close < src.length; close++) {
        if (src[close] === CHAR.parenOpen) depth++;
        else if (src[close] === CHAR.parenClose && --depth === 0) break;
      }
      open = src.slice(close + 1).search(NOT_SPACE) + close + 1;
      if (src[open] !== CHAR.open) continue;
    }
    const end = blockEnd(src, open);
    const body = src.slice(start, end + 1);
    if (end > at) best = { loopVar: match[1] ?? '', body: src[start] === CHAR.open ? body : CHAR.open + body + CHAR.close };
  }
  return best;
}

export function runGameCode(code: string, name: string, { set = {}, keep = [] }: { set?: Readonly<Record<string, unknown>>; keep?: readonly string[] } = {}): void {
  const saved = Object.fromEntries(SCRATCH.map((scratch) => [scratch, globalOf(scratch)]));
  const names = [...new Set([...Object.keys(set), ...keep])];
  const head = names.map((kept, position) => saveKept(keptName(position), kept) + (kept in set ? setKept(kept, JSON.stringify(set[kept])) : '')).join('');
  const tail = names.map((kept, position) => restoreKept(kept, keptName(position))).join('');
  try {
    run(tryFinally(head, code, tail), name);
  } finally {
    for (const scratch of SCRATCH) Reflect.set(globalThis, scratch, saved[scratch]);
  }
}

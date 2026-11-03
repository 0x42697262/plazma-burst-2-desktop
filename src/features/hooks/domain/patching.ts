import { FIND_SHOWN_MAX } from '../constants.ts';
import {
  BACKSLASH, CLOSE_PAREN, COUNT_ALL, ESCAPED_MATCH, EXTERNAL_URL, GLOBAL_FLAG, LEADING_DOT_SLASH, NON_SPACE, OPEN_BRACE, OPEN_PAREN, PLACEHOLDER, QUOTES,
  REGEX_SPECIAL, REGEXP_TAG, SCRIPT_SOURCE, functionDeclaration, trampoline,
} from '../keys.ts';
import { TEXT } from '../text.ts';
import { textOf } from '#kernel/text/text-of.ts';

export type Names = Readonly<Record<string, string>>;
export type Replace = string | ((match: string, ...groups: string[]) => unknown);
export type Patch = { file: string; find: string | RegExp; replace: Replace; count: number | typeof COUNT_ALL };
export type Target = { key: string | null; name: string };
export type HookShape = { targets: readonly Target[]; patches: readonly Patch[] };
export type Match = { index: number; text: string; groups: string[] };
export type Applied = { files: Map<string, string>; targets: Record<string, number> };
export class HookClash extends Error {
  readonly hook: HookShape;

  constructor(hook: HookShape, message: string) {
    super(message);
    this.hook = hook;
  }
}

export const escapeRegExp = (text: string): string => text.replace(REGEX_SPECIAL, ESCAPED_MATCH);
export const isRegExp = (value: unknown): value is RegExp => Object.prototype.toString.call(value) === REGEXP_TAG;

export function listScripts(html: string): string[] {
  return [...html.matchAll(SCRIPT_SOURCE)]
    .map((match) => (match[1] ?? '').replace(LEADING_DOT_SLASH, ''))
    .filter((source) => source && !EXTERNAL_URL.test(source));
}

type ScriptsManifest = { strings?: Record<string, unknown>; order?: unknown };

export function listManifestScripts(rawManifest: string): string[] {
  try {
    const parsed = JSON.parse(rawManifest) as ScriptsManifest;
    const strings: unknown[] = parsed.strings && typeof parsed.strings === 'object' ? Object.values(parsed.strings) : [];
    const order: unknown[] = Array.isArray(parsed.order) ? (parsed.order as unknown[]) : [];
    return [...strings, ...order].filter((entry): entry is string => typeof entry === 'string' && entry.length > 0);
  } catch {
    return [];
  }
}

export function fillNames(text: string, names: Names, regexSafe: boolean): string {
  return text.replace(PLACEHOLDER, (_whole, key: string) => {
    const name = names[key];
    if (!name) throw new Error(TEXT.missingName(key));
    return regexSafe ? escapeRegExp(name) : name;
  });
}

function skipParameters(source: string, open: number): number {
  let depth = 0;
  for (let index = open; index < source.length; index++) {
    const character = source[index] ?? '';
    if (QUOTES.includes(character)) {
      for (index++; index < source.length && source[index] !== character; index++) if (source[index] === BACKSLASH) index++;
      continue;
    }
    if (character === OPEN_PAREN) depth++;
    else if (character === CLOSE_PAREN && --depth === 0) return index + 1;
  }
  return -1;
}

export function findFunction(source: string, name: string): number[] {
  const bodies: number[] = [];
  for (const match of source.matchAll(functionDeclaration(escapeRegExp(name)))) {
    const open = (match.index ?? 0) + match[0].length - 1;
    const close = skipParameters(source, open);
    if (close < 0) continue;
    const brace = source.slice(close).search(NON_SPACE);
    if (brace >= 0 && source[close + brace] === OPEN_BRACE) bodies.push(close + brace + 1);
  }
  return bodies;
}

export function patchMatches(source: string, patch: Patch, names: Names): Match[] {
  if (typeof patch.find === 'string') {
    const needle = fillNames(patch.find, names, false);
    if (!needle) throw new Error(TEXT.emptyFind);
    const found: Match[] = [];
    for (let index = source.indexOf(needle); index >= 0; index = source.indexOf(needle, index + needle.length)) found.push({ index, text: needle, groups: [] });
    return found;
  }
  const flags = patch.find.flags.includes(GLOBAL_FLAG) ? patch.find.flags : patch.find.flags + GLOBAL_FLAG;
  const pattern = new RegExp(fillNames(patch.find.source, names, true), flags);
  return [...source.matchAll(pattern)].map((match) => ({ index: match.index ?? 0, text: match[0], groups: match.slice(1) }));
}

const patchText = (patch: Patch, match: Match, names: Names): string => (typeof patch.replace === 'function'
  ? textOf(patch.replace(match.text, ...match.groups))
  : fillNames(patch.replace, names, false));

export function checkCount(patch: Patch, found: number): void {
  const isWrong = patch.count === COUNT_ALL ? found === 0 : found !== patch.count;
  if (!isWrong) return;
  const shown = typeof patch.find === 'string' ? TEXT.shortFind(patch.find, FIND_SHOWN_MAX) : String(patch.find);
  throw new Error(TEXT.countWrong(patch.file, shown, found, TEXT.countWanted(patch.count)));
}

export function applyPatch(source: string, patch: Patch, names: Names): string {
  const matches = patchMatches(source, patch, names);
  checkCount(patch, matches.length);
  let changed = '';
  let at = 0;
  for (const match of matches) {
    changed += source.slice(at, match.index) + patchText(patch, match, names);
    at = match.index + match.text.length;
  }
  return changed + source.slice(at);
}

export function locate(sources: ReadonlyMap<string, string>, name: string): { file: string; index: number } {
  const hits: { file: string; index: number }[] = [];
  for (const [file, source] of sources) for (const index of findFunction(source, name)) hits.push({ file, index });
  const [only] = hits;
  if (hits.length === 1 && only) return only;
  if (!hits.length) throw new Error(TEXT.noDeclaration(name));
  throw new Error(TEXT.manyDeclarations(name, hits.length, hits.map((hit) => hit.file).join(TEXT.fileSeparator)));
}

export function validate(hook: HookShape, sources: ReadonlyMap<string, string>, names: Names): void {
  for (const patch of hook.patches) {
    const source = sources.get(patch.file);
    if (source === undefined) throw new Error(TEXT.unknownScript(patch.file));
    checkCount(patch, patchMatches(source, patch, names).length);
  }
  for (const target of hook.targets) locate(sources, target.name);
}

export function apply(hooks: readonly HookShape[], originals: ReadonlyMap<string, string>, names: Names): Applied {
  const work = new Map(originals);
  for (const hook of hooks) {
    try {
      for (const patch of hook.patches) work.set(patch.file, applyPatch(work.get(patch.file) ?? '', patch, names));
    } catch (error) {
      throw new HookClash(hook, TEXT.afterHooks((error as Error).message));
    }
  }
  const targets: Record<string, number> = {};
  const owners = new Map<string, HookShape>();
  for (const hook of hooks) {
    for (const target of hook.targets) {
      if (target.name in targets) continue;
      targets[target.name] = Object.keys(targets).length;
      owners.set(target.name, hook);
    }
  }
  for (const [name, id] of Object.entries(targets)) {
    let at: { file: string; index: number };
    try {
      at = locate(work, name);
    } catch (error) {
      throw new HookClash(owners.get(name) ?? { targets: [], patches: [] }, TEXT.afterPatches((error as Error).message));
    }
    const source = work.get(at.file) ?? '';
    work.set(at.file, source.slice(0, at.index) + trampoline(id, name) + source.slice(at.index));
  }
  const files = new Map<string, string>();
  for (const [file, source] of work) if (source !== originals.get(file)) files.set(file, source);
  return { files, targets };
}

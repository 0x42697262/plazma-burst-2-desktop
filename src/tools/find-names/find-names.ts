import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { CHECKS, FILES, MAX_PASSES, RULES, type FileKey, type Rule } from './constants.ts';
import {
  ANY_NAME_PATTERN, CAPTURE_KEY, CAPTURE_PATTERN, ESCAPED_MATCH, GLOBAL_FLAG, HEX_RADIX, IGNORED_KEY, LINE_END, NON_ASCII, PLACEHOLDER, SPECIAL_CHARACTERS,
  STRINGS_FILE, STRING_PREFIX, STRING_VARIABLE, TEXT_ENCODING, UNICODE_DIGITS, UNICODE_PREFIX, UNKNOWN_VERSION, VERSION_FILE, ZERO,
} from './keys.ts';
import { TEXT } from './text.ts';

export { CHECKS, FILES, RULES };
export { ID_CHARS } from './keys.ts';

export type NameInfo = { what: string | null | undefined; file: string; matches?: number };
export type FoundNames = {
  found: Record<string, string>;
  info: Record<string, NameInfo>;
  problems: string[];
  missing: string[];
  expected: string[];
};

export const escapeRe = (text: string): string => text.replace(SPECIAL_CHARACTERS, ESCAPED_MATCH);
const ascii = (text: string): string => text.replace(NON_ASCII, (character) => UNICODE_PREFIX + character.charCodeAt(0).toString(HEX_RADIX).padStart(UNICODE_DIGITS, ZERO));

export const expectedKeys = (): string[] => RULES.flatMap((rule) => rule.keys).filter((key) => key !== IGNORED_KEY);

export function stringsOf(sandbox: Record<string, unknown>): Map<string, string> {
  const strings = new Map<string, string>();
  for (const [key, value] of Object.entries(sandbox)) if (typeof value === 'string' && key.startsWith(STRING_PREFIX)) strings.set(key, value);
  return strings;
}

export function loadStrings(gameDir: string): Map<string, string> {
  const sandbox: Record<string, unknown> = {};
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(gameDir, STRINGS_FILE), TEXT_ENCODING), sandbox);
  return stringsOf(sandbox);
}

export function decode(source: string, strings: ReadonlyMap<string, string>): string {
  return source.replace(STRING_VARIABLE, (match, before: string, name: string) => {
    const value = strings.get(name);
    return value === undefined ? match : before + JSON.stringify(value);
  });
}

export function compile(source: string, found: Readonly<Record<string, string>>): RegExp {
  const pattern = source.replace(PLACEHOLDER, (_match, key: string) => {
    if (key === CAPTURE_KEY) return CAPTURE_PATTERN;
    if (key === IGNORED_KEY) return ANY_NAME_PATTERN;
    const name = found[key];
    if (!name) throw new Error(TEXT.needsFirst(key));
    return escapeRe(name);
  });
  return new RegExp(pattern, GLOBAL_FLAG);
}

function tryCompile(source: string, found: Readonly<Record<string, string>>): RegExp | null {
  try {
    return compile(source, found);
  } catch {
    return null;
  }
}

export function matchRule(rule: Rule, code: string, found: Readonly<Record<string, string>>): { values: Set<string>[]; count: number } | null {
  const pattern = tryCompile(rule.re, found);
  if (!pattern) return null;
  const values = rule.keys.map(() => new Set<string>());
  let count = 0;
  for (const match of code.matchAll(pattern)) {
    count++;
    rule.keys.forEach((_key, index) => { values[index]?.add(match[index + 1] ?? ''); });
  }
  return { values, count };
}

const keysText = (keys: readonly string[]): string => keys.filter((key) => key !== IGNORED_KEY).join(TEXT.keySeparator);

export function findNames(gameDir: string): FoundNames {
  const strings = loadStrings(gameDir);
  const code = {} as Record<FileKey, string>;
  for (const [key, relative] of Object.entries(FILES) as [FileKey, string][]) code[key] = decode(fs.readFileSync(path.join(gameDir, relative), TEXT_ENCODING), strings);
  const found: Record<string, string> = {};
  const info: Record<string, NameInfo> = {};
  const problems: string[] = [];
  let pending: readonly Rule[] = RULES;
  for (let pass = 0; pending.length && pass < MAX_PASSES; pass++) {
    const next: Rule[] = [];
    for (const rule of pending) {
      const matched = matchRule(rule, code[rule.file], found);
      if (!matched) {
        next.push(rule);
        continue;
      }
      if (!matched.count) {
        problems.push(TEXT.notFound(keysText(rule.keys), FILES[rule.file]));
        continue;
      }
      rule.keys.forEach((key, index) => {
        if (key === IGNORED_KEY) return;
        const values = [...(matched.values[index] ?? [])];
        if (values.length > 1) {
          problems.push(TEXT.ambiguous(key, FILES[rule.file], values));
          return;
        }
        found[key] = values[0] ?? '';
        info[key] = { what: rule.what[index], file: FILES[rule.file], matches: matched.count };
      });
    }
    if (next.length === pending.length) {
      for (const rule of next) problems.push(TEXT.dependsOnMissing(rule.keys.join(TEXT.keySeparator)));
      break;
    }
    pending = next;
  }
  for (const check of CHECKS) {
    try {
      if (!compile(check.re, found).test(code[check.file])) problems.push(TEXT.checkFailed(check.what));
    } catch (error) {
      problems.push(TEXT.checkSkipped((error as Error).message, check.what));
    }
  }
  const expected = expectedKeys();
  const missing = expected.filter((key) => !found[key]);
  return { found, info, problems, missing, expected };
}

export function gameVersion(gameDir: string): string {
  try {
    return (JSON.parse(fs.readFileSync(path.join(gameDir, VERSION_FILE), TEXT_ENCODING)) as { version?: string }).version || UNKNOWN_VERSION;
  } catch {
    return UNKNOWN_VERSION;
  }
}

export function render(result: Pick<FoundNames, 'expected' | 'found' | 'info'>, version: string): string {
  const lines = [...TEXT.header(version)];
  for (const key of result.expected) {
    const name = result.found[key];
    const about = result.info[key];
    if (!name || !about) {
      lines.push(TEXT.missingLine(key));
      continue;
    }
    lines.push(TEXT.nameLine(key, ascii(name), name, about.what ?? '', about.file));
  }
  lines.push(...TEXT.footer);
  return lines.join(LINE_END);
}

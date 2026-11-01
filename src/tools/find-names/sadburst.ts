import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { CLIENTS } from '#kernel/config/clients.ts';
import { MANIFEST, type Manifest } from '../fetch-game/sadburst.ts';
import { MAX_PASSES, RULES, type Rule } from './constants.ts';
import { FALSE_WORD, IGNORED_KEY, LINE_END, MINIFIED_BOOLEAN, MINIFIED_TRUE, SCRIPT_SEPARATOR, TRUE_WORD, wholeNamePattern, NAMES_FILE_RUN, NAMES_FILE_RUN_SADBURST, NAMES_OBJECT_START, STRINGS_FILE, TEXT_ENCODING } from './keys.ts';
import { TEXT } from './text.ts';
import { decode, escapeRe, expectedKeys, gameVersion, matchRule, render, findNames as findOfficialNames, stringsOf, type NameInfo } from './find-names.ts';

export const NOT_IN_CLIENT = TEXT.notInClient;

type NameSource = { label: string; names: Record<string, unknown> };
export type SadburstNames = {
  found: Record<string, string>;
  info: Record<string, NameInfo>;
  problems: string[];
  missing: string[];
  expected: string[];
  absent: string[];
  how: { pattern: number; same: number };
};
export type SadburstOptions = { gameDir?: string; out?: string; check?: boolean; officialDir?: string; officialNames?: string; previous?: string; say?: (line: string) => void };


export const unminify = (source: string): string => source.replace(MINIFIED_BOOLEAN, (_match, digit: string) => (digit === MINIFIED_TRUE ? TRUE_WORD : FALSE_WORD));

function loadStrings(gameDir: string, manifest: Manifest): Map<string, string> {
  const sandbox: Record<string, unknown> = {};
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(gameDir, manifest.strings.en ?? ''), TEXT_ENCODING), sandbox);
  return stringsOf(sandbox);
}

export function loadCode(gameDir: string): { manifest: Manifest; strings: Map<string, string>; code: string } {
  const manifest = JSON.parse(fs.readFileSync(path.join(gameDir, MANIFEST), TEXT_ENCODING)) as Manifest;
  const strings = loadStrings(gameDir, manifest);
  const code = manifest.order.map((file) => decode(fs.readFileSync(path.join(gameDir, file), TEXT_ENCODING), strings)).join(SCRIPT_SEPARATOR);
  return { manifest, strings, code: unminify(code) };
}

function readNamesFile(file: string): Record<string, unknown> {
  try {
    const sandbox: Record<string, unknown> = {};
    sandbox.globalThis = sandbox;
    vm.createContext(sandbox);
    vm.runInContext(fs.readFileSync(file, TEXT_ENCODING), sandbox);
    const names = sandbox.PB2_NAMES;
    return names && typeof names === 'object' ? { ...(names as Record<string, unknown>) } : {};
  } catch {
    return {};
  }
}

function officialClientNames(officialDir: string): Record<string, unknown> | null {
  try {
    return findOfficialNames(officialDir).found;
  } catch {
    return null;
  }
}

export function nameSources({ officialDir, officialNames, previous }: { officialDir?: string; officialNames?: string; previous?: string }): NameSource[] {
  const sources: NameSource[] = [];
  if (previous && fs.existsSync(previous)) sources.push({ label: TEXT.sourceLabel.previous, names: readNamesFile(previous) });
  if (officialDir && fs.existsSync(path.join(officialDir, STRINGS_FILE))) {
    const names = officialClientNames(officialDir);
    if (names) sources.push({ label: TEXT.sourceLabel.officialClient, names });
  }
  if (officialNames && fs.existsSync(officialNames)) sources.push({ label: TEXT.sourceLabel.officialNames, names: readNamesFile(officialNames) });
  return sources;
}

export function findNames(gameDir: string, sources: readonly NameSource[]): SadburstNames {
  const { code } = loadCode(gameDir);
  const appears = (name: string): boolean => wholeNamePattern(escapeRe(name)).test(code);
  const found: Record<string, string> = {};
  const info: Record<string, NameInfo> = {};
  const problems: string[] = [];
  const how = { pattern: 0, same: 0 };
  const whatOf: Record<string, string | null | undefined> = {};
  for (const rule of RULES) rule.keys.forEach((key, index) => { if (key !== IGNORED_KEY) whatOf[key] = rule.what[index]; });

  let pending: readonly Rule[] = RULES;
  for (let pass = 0; pending.length && pass < MAX_PASSES; pass++) {
    const next: Rule[] = [];
    for (const rule of pending) {
      const matched = matchRule(rule, code, found);
      if (!matched) {
        next.push(rule);
        continue;
      }
      if (!matched.count) continue;
      rule.keys.forEach((key, index) => {
        const values = matched.values[index] ?? new Set<string>();
        if (key === IGNORED_KEY || found[key] || values.size !== 1) return;
        found[key] = [...values][0] ?? '';
        info[key] = { what: whatOf[key], file: TEXT.patternFile, matches: matched.count };
        how.pattern++;
      });
    }
    if (next.length === pending.length) break;
    pending = next;
  }

  const expected = expectedKeys();
  for (const key of expected) {
    if (found[key]) continue;
    for (const source of sources) {
      const name = source.names[key];
      if (typeof name === 'string' && name && appears(name)) {
        found[key] = name;
        info[key] = { what: whatOf[key], file: TEXT.sameAs(source.label) };
        how.same++;
        break;
      }
    }
  }
  for (const source of sources) {
    for (const [key, name] of Object.entries(source.names)) {
      const foundByPattern = info[key]?.file === TEXT.patternFile;
      if (foundByPattern && typeof name === 'string' && name !== found[key] && appears(name)) problems.push(TEXT.differs(key, found[key] ?? '', source.label, name));
    }
  }
  if (!sources.length) problems.push(TEXT.noSources);
  const absent = expected.filter((key) => !found[key] && NOT_IN_CLIENT[key]);
  const wanted = expected.filter((key) => !absent.includes(key));
  const missing = wanted.filter((key) => !found[key]);
  return { found, info, problems, missing, expected: wanted, absent, how };
}

export function run(options: SadburstOptions = {}): SadburstNames {
  const say = options.say ?? ((line: string) => { console.log(line); });
  const client = CLIENTS.sadburst;
  const gameDir = path.resolve(options.gameDir || client.gameDir);
  const out = path.resolve(options.out || client.names);
  if (!fs.existsSync(path.join(gameDir, MANIFEST))) throw new Error(TEXT.sadburstMissing(gameDir));
  const sources = nameSources({
    officialDir: options.officialDir === undefined ? CLIENTS.official.gameDir : options.officialDir,
    officialNames: options.officialNames === undefined ? CLIENTS.official.names : options.officialNames,
    previous: options.previous === undefined ? out : options.previous,
  });
  const result = findNames(gameDir, sources);
  const version = gameVersion(gameDir);
  const total = result.expected.length;
  say(TEXT.sadburstFound(total - result.missing.length, total, gameDir, version, result.how.pattern, result.how.same));
  if (result.missing.length) say(TEXT.notFoundList(result.missing));
  if (result.absent.length) say(TEXT.absentList(result.absent));
  for (const problem of result.problems) say(TEXT.problem(problem));
  if (!options.check) {
    const notes = result.absent.map((key) => TEXT.absentNote(key, NOT_IN_CLIENT[key] ?? ''));
    const text = render(result, version).replace(NAMES_FILE_RUN, NAMES_FILE_RUN_SADBURST).replace(NAMES_OBJECT_START, [...notes, NAMES_OBJECT_START].join(LINE_END));
    fs.writeFileSync(out, text);
    say(TEXT.wrote(path.relative(process.cwd(), out) || out));
  }
  return result;
}

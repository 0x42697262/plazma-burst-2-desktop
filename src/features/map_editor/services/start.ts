import { GAME_FIELDS } from '#console/kernel/game/fields.ts';
import { escapeRe } from '#console/kernel/core/words.ts';
import { branchNames, loaderSource } from './loader.ts';
import { MISSING_FIELD, START_ATTR, copyPattern, enabledCopyPattern } from './keys.ts';

type Patterns = Record<string, RegExp>;

const PATTERNS: Readonly<Record<string, () => Patterns>> = Object.freeze({
  door: () => ({
    x: copyPattern(START_ATTR.x), y: copyPattern(START_ATTR.y), tarx: copyPattern(START_ATTR.tarx), tary: copyPattern(START_ATTR.tary),
  }),
  trigger: () => ({ enabled: enabledCopyPattern(escapeRe(GAME_FIELDS.T_ENABLED || MISSING_FIELD)) }),
  timer: () => ({ enabled: enabledCopyPattern(escapeRe(GAME_FIELDS.T_ENABLED || MISSING_FIELD)) }),
});

let names: Record<string, Record<string, string>> = {};
let namesFor: string | null = null;

function namesOf(tag: string): Record<string, string> {
  const src = loaderSource();
  if (namesFor !== src) {
    names = {};
    namesFor = src;
  }
  const patterns = Object.hasOwn(PATTERNS, tag) ? PATTERNS[tag] : undefined;
  names[tag] ??= patterns ? branchNames(tag, patterns()) : {};
  return names[tag];
}

export function setStart(tag: string, target: object | null | undefined, key: string, value: unknown): void {
  const name = namesOf(tag)[key];
  if (name && target) Reflect.set(target, name, value);
}

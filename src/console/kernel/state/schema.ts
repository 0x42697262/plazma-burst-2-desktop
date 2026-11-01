import { onOff } from '../core/words.ts';
import { stringOf } from '#kernel/text/text-of.ts';
import { SCHEMA, aliasesFor, type KeyNames, type SettingKey, type SettingSpec } from './constants.ts';
import { CONSOLE_GROUPS, FALSE_WORDS, GROUP, NO_KEY_WORD, SETTING_TYPE, TRUE_WORDS, type Group } from './keys.ts';
import { TEXT } from './text.ts';
import { parseKeyName, showKey } from './key-names.ts';

export { SCHEMA, GROUP };
export type { SettingKey, SettingSpec };

export const CLIENT_ONLY_REASON = TEXT.clientOnlyReason;

const KEY_NAMES = Object.freeze(Object.fromEntries(Object.keys(SCHEMA).map((key) => [key.toUpperCase(), key])));

export const KEY = new Proxy(KEY_NAMES, {
  get(names, name) {
    if (typeof name !== 'string' || !Object.hasOwn(names, name)) throw new Error(TEXT.noSetting(String(name)));
    return names[name];
  },
}) as unknown as KeyNames;

export const ALIASES = aliasesFor(KEY);

const specOf = (key: string): SettingSpec | undefined => (Object.hasOwn(SCHEMA, key) ? SCHEMA[key as SettingKey] : undefined);
const requireSpec = (key: string): SettingSpec => {
  const spec = specOf(key);
  if (!spec) throw new Error(TEXT.noSetting(key));
  return spec;
};

export const GROUPS: readonly Group[] = Object.freeze([...new Set(Object.values(SCHEMA).map((spec: SettingSpec) => spec.group))]);

export function resolveKey(word: string | null | undefined): SettingKey | null {
  if (!word) return null;
  const lowered = word.toLowerCase();
  if (specOf(lowered)) return lowered as SettingKey;
  return ALIASES[lowered] ?? null;
}

export const aliasesOf = (key: string): string[] => Object.keys(ALIASES).filter((alias) => ALIASES[alias] === key);

export const affectsGame = (key: string): boolean => !CONSOLE_GROUPS.has(requireSpec(key).group);
export const keyClientOnly = (key: string | null | undefined): string | undefined => (key && affectsGame(key) ? CLIENT_ONLY_REASON : undefined);

export const unphrase = (text: string): string => Object.entries(SCHEMA as Record<string, SettingSpec>)
  .reduce((phrased, [key, spec]) => (spec.phrases ?? []).reduce((current, pattern) => current.replace(pattern, key), phrased), text);

export function parseValue(key: string, raw: unknown): boolean | number | string {
  const spec = requireSpec(key);
  const lowered = stringOf(raw).toLowerCase();
  if (spec.type === SETTING_TYPE.bool) {
    if (TRUE_WORDS.includes(lowered)) return true;
    if (FALSE_WORDS.includes(lowered)) return false;
    throw new Error(TEXT.expectsOnOff(key));
  }
  if (spec.type === SETTING_TYPE.key) {
    const meansNoKey = raw === false || FALSE_WORDS.includes(lowered) || lowered === NO_KEY_WORD;
    return meansNoKey ? false : parseKeyName(raw);
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(TEXT.expectsNumber(key));
  if (spec.type === SETTING_TYPE.int && !Number.isInteger(value)) throw new Error(TEXT.expectsWholeNumber(key));
  const min = spec.min ?? -Infinity;
  const max = spec.max ?? Infinity;
  if (value < min || value > max) throw new Error(TEXT.outOfRange(key, min, max));
  return value;
}

export const showValue = (key: string, value: unknown): string => (requireSpec(key).type === SETTING_TYPE.key && typeof value === 'string' ? showKey(value) : onOff(value));

export function describeKey(key: string): string {
  const spec = requireSpec(key);
  return spec.default === undefined ? spec.desc : TEXT.withDefault(spec.desc, showValue(key, spec.default));
}

import { onOff } from '../core/words.ts';
import { stringOf } from '#kernel/text/text-of.ts';
import { FEATURE, type FeatureId } from '#shared/features/keys.ts';
import { CORE_SETTINGS, type SettingSpec } from './constants.ts';
import { CONSOLE_GROUPS, FALSE_WORDS, GROUP, NO_KEY_WORD, SETTING_TYPE, TRUE_WORDS, type Group, type RankedHold } from './keys.ts';
import { TEXT } from './text.ts';
import { parseKeyName, showKey } from './key-names.ts';
import { isCapabilityOn, isFeatureOn } from '../../flags.ts';

export { GROUP };
export type SettingKey = string;
export type { SettingSpec };
export type Hotkey = Readonly<{ what: string; command: string }>;
export type KeySpec = Omit<SettingSpec, 'feature'> & Readonly<{ aliases?: readonly string[]; hotkey?: Hotkey; rankedHold?: RankedHold }>;
type RegisteredSpec = SettingSpec & Readonly<{ hotkey?: Hotkey; rankedHold?: RankedHold }>;

export const CLIENT_ONLY_REASON = TEXT.clientOnlyReason;

export const SCHEMA: Record<string, RegisteredSpec> = {};
export const ALIASES: Record<string, string> = {};

export function registerSettings(feature: FeatureId, settings: Readonly<Record<string, KeySpec>>): void {
  for (const [key, { aliases = [], ...spec }] of Object.entries(settings)) {
    if (Object.hasOwn(SCHEMA, key)) throw new Error(TEXT.settingTwice(key));
    SCHEMA[key] = Object.freeze({ feature, ...spec });
    for (const alias of aliases) ALIASES[alias] = key;
  }
}

registerSettings(FEATURE.consoleCore, CORE_SETTINGS);

export const specOf = (key: string): RegisteredSpec | undefined => (Object.hasOwn(SCHEMA, key) ? SCHEMA[key] : undefined);
const requireSpec = (key: string): RegisteredSpec => {
  const spec = specOf(key);
  if (!spec) throw new Error(TEXT.noSetting(key));
  return spec;
};

export const isKeyOn = (key: string): boolean => {
  const spec = specOf(key);
  return spec !== undefined && isFeatureOn(spec.feature) && (spec.capability === undefined || isCapabilityOn(spec.capability));
};

export const keysOn = (): SettingKey[] => (Object.keys(SCHEMA)).filter(isKeyOn);

export const groupsOn = (): Group[] => [...new Set(keysOn().map((key) => requireSpec(key).group))];

export function resolveKey(word: string | null | undefined): SettingKey | null {
  if (!word) return null;
  const lowered = word.toLowerCase();
  const key = specOf(lowered) ? lowered : ALIASES[lowered] ?? null;
  return key !== null && isKeyOn(key) ? key : null;
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

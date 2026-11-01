import { SCHEMA, resolveKey, parseValue, affectsGame, showValue } from '../../../../desktop/dev/console/state/schema.js';
import { settings, profiles, activeProfile, currentMap } from '../../../../desktop/dev/console/state/store.js';
import { parseKeyName, showKey } from '../../../../desktop/dev/console/state/keys.js';
import { isActive } from '../../../../desktop/dev/console/game/level.js';
import { commandText, warnKeyUses } from '#console/kernel/commands/command-text.ts';
import { run } from '../../../../desktop/dev/console/dispatch.js';

export type Profile = { values: Record<string, unknown>; binds: Record<string, string>; onload: string };
export type ActiveProfile = Profile & { name: string };

type ProfileStore = {
  names(): string[]; exists(name: string): boolean; get(name: string): Profile; of(map: string): string | null;
  mapsUsing(name: string): string[]; use(map: string, name: string | null): void; set(name: string, key: string, value: unknown): void;
  unset(name: string, key: string): void; bind(name: string, key: string, command: string): void; unbind(name: string, key: string): void;
  setOnload(name: string, command: string): void; remove(name: string): string[];
};
type SettingsStore = { hasOwn(key: string): boolean; own(key: string): unknown };

export const profileStore = profiles as unknown as ProfileStore;
const ownSettings = settings as unknown as SettingsStore;

export const profileContext = {
  currentMap: (): string | null => (currentMap)(),
  active: (): ActiveProfile | null => (activeProfile as () => ActiveProfile | null)(),
  hasOwnSetting: (key: string): boolean => ownSettings.hasOwn(key),
  ownSetting: (key: string): unknown => ownSettings.own(key),
  resolveKey: (word: string): string | null => (resolveKey as (word: string) => string | null)(word),
  parseValue: (key: string, raw: string): unknown => (parseValue as (key: string, raw: string) => unknown)(key, raw),
  affectsGame: (key: string): boolean => (affectsGame as (key: string) => boolean)(key),
  showValue: (key: string, value: unknown): string => (showValue as (key: string, value: unknown) => string)(key, value),
  parseKeyName: (word: string): string => (parseKeyName as (word: string) => string)(word),
  showKey: (key: string): string => (showKey as (key: string) => string)(key),
  commandText,
  warnKeyUses,
  isLevelActive: (): boolean => (isActive)(),
  run: (line: string, source: string): void => { (run as (line: string, source: string) => void)(line, source); },
  gameKeyGroups: (): string[] => [...new Set(Object.entries(SCHEMA as Record<string, { group: string }>).filter(([key]) => (affectsGame as (key: string) => boolean)(key)).map(([, schema]) => schema.group))],
};

export type ProfileContext = typeof profileContext;

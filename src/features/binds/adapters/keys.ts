import { parseKeyName, showKey, baseKey, eventKeyName, GAME_KEYS, TOGGLE_KEY } from '../../../../desktop/dev/console/state/keys.js';
import { binds, activeProfile } from '../../../../desktop/dev/console/state/store.js';
import { hotkeyOf } from '../../../../desktop/dev/console/state/hotkeys.js';
import { catchNextKey } from '../../../../desktop/dev/console/ui/panel.js';

export type ActiveBind = { command: string; profile: string | null } | null;
export type KeyEvent = { key?: string; code?: string };
type BindStore = {
  keys(): string[]; get(key: string): string | undefined; set(key: string, command: string): void;
  remove(key: string): void; clear(): number; active(key: string): ActiveBind; boundTo(command: string): string[];
};

export const bindStore: BindStore = binds;

export const keyNames = {
  parse: (word: string): string => (parseKeyName as (word: string) => string)(word),
  show: (key: string): string => (showKey as (key: string) => string)(key),
  base: (key: string): string => (baseKey as (key: string) => string)(key),
  ofEvent: (event: KeyEvent): string => (eventKeyName as (event: KeyEvent) => string)(event),
  gameUse: (key: string): string | undefined => (GAME_KEYS as Record<string, string | undefined>)[key],
  toggle: TOGGLE_KEY as string,
  hotkey: (key: string): { what: string; key: string } | null => (hotkeyOf as (key: string) => { what: string; key: string } | null)(key),
  activeProfile: (): { name: string; binds: Record<string, string> } | null => (activeProfile as () => { name: string; binds: Record<string, string> } | null)(),
  catchNextKey: (report: (event: KeyEvent | null) => void): (() => void) => (catchNextKey as (report: (event: KeyEvent | null) => void) => () => void)(report),
};

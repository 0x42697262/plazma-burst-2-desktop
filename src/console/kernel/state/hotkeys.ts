import { SCHEMA, type Hotkey } from './schema.ts';
import { settings } from './store.ts';

export type BoundHotkey = Hotkey & Readonly<{ key: string }>;

export const hotkeys = (): BoundHotkey[] => Object.entries(SCHEMA).flatMap(([key, spec]) => (spec.hotkey ? [{ key, ...spec.hotkey }] : []));

export const hotkeyOf = (name: string): BoundHotkey | undefined => hotkeys().find((hotkey) => settings.effective(hotkey.key) === name);

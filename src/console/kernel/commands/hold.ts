import { MODIFIER, KEY_SEPARATOR } from '../state/keys.ts';
import { resolveKey, specOf } from '../state/schema.ts';
import { findRunnable } from './registry.ts';
import { BOOL_TYPE, CHAIN_SEPARATOR, HOLD_OPTION, HOLD_WORD, MOUSE_BUTTON_NAMES, WHITESPACE, withWord } from './keys.ts';

export type HoldCommands = Readonly<{ press: string; release: string }>;
export type MouseButtonEvent = Readonly<{ button: number; ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean }>;

export function holdCommands(command: string): HoldCommands | null {
  const text = command.trim();
  if (!text || text.includes(CHAIN_SEPARATOR)) return null;
  const [first = '', ...rest] = text.split(WHITESPACE);
  if (findRunnable(first)?.holds) return { press: withWord(text, HOLD_OPTION.on), release: withWord(text, HOLD_OPTION.off) };
  const key = findRunnable(first) ? null : resolveKey(first);
  const isOnOffSetting = !!key && specOf(key)?.type === BOOL_TYPE && !rest.length;
  return isOnOffSetting ? { press: withWord(text, HOLD_WORD.on), release: withWord(text, HOLD_WORD.off) } : null;
}

export function mouseButtonName(event: MouseButtonEvent): string {
  const base = MOUSE_BUTTON_NAMES[event.button];
  if (!base) return '';
  const modifiers = [event.ctrlKey && MODIFIER.ctrl, event.altKey && MODIFIER.alt, event.shiftKey && MODIFIER.shift].filter(Boolean);
  return [...modifiers, base].join(KEY_SEPARATOR);
}

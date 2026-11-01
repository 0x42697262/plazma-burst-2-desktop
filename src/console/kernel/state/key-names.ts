import {
  BACKQUOTE, BACKQUOTE_WORD, DIGIT_CODE, FIRST_GROUP, INPUT_KEYS, KEY_NAME, KEY_SEPARATOR, LETTER_CODE, MODIFIER, MODIFIER_ALIASES,
  MODIFIER_KEY_NAME, MODIFIERS, PLUS_KEY, SHIFTED_KEYS, SYMBOL_KEYS, TOGGLE_KEY,
} from './keys.ts';
import { TEXT } from './text.ts';
import { stringOf } from '#kernel/text/text-of.ts';

export { GAME_KEYS, TOGGLE_KEY } from './keys.ts';

export type KeyEvent = { code?: string; key?: string; ctrlKey?: boolean; altKey?: boolean; shiftKey?: boolean };

const normalize = (base: string): string => base.replace(LETTER_CODE, FIRST_GROUP).replace(DIGIT_CODE, FIRST_GROUP);

export const showKey = (key: string): string => key.replace(BACKQUOTE_WORD, BACKQUOTE);
export const baseKey = (key: string): string => key.split(KEY_SEPARATOR).pop() ?? '';

export function parseKeyName(raw: unknown): string {
  const parts = stringOf(raw || '').toLowerCase().split(KEY_SEPARATOR);
  let base = parts.pop() ?? '';
  const isPlusKey = base === '' && parts.length > 0 && parts[parts.length - 1] === '';
  if (isPlusKey) {
    parts.pop();
    base = PLUS_KEY;
  }
  const modifiers = new Set<string>();
  for (const part of parts) {
    const modifier = MODIFIER_ALIASES[part] ?? part;
    if (!MODIFIERS.includes(modifier)) throw new Error(TEXT.unknownModifier(part));
    modifiers.add(modifier);
  }
  const unshifted = SHIFTED_KEYS[base];
  if (unshifted) {
    modifiers.add(MODIFIER.shift);
    base = unshifted;
  }
  base = normalize(SYMBOL_KEYS[base] ?? base);
  if (!base || !KEY_NAME.test(base)) throw new Error(TEXT.notAKey(stringOf(raw)));
  if (MODIFIERS.includes(base) || MODIFIER_KEY_NAME.test(base)) throw new Error(TEXT.modifierAlone);
  const name = [...MODIFIERS.filter((modifier) => modifiers.has(modifier)), base].join(KEY_SEPARATOR);
  if (name === TOGGLE_KEY) throw new Error(TEXT.togglesConsole(showKey(TOGGLE_KEY)));
  if (INPUT_KEYS.includes(base)) throw new Error(TEXT.usedByInput(base));
  return name;
}

export function eventKeyName(event: KeyEvent): string {
  let base = (event.code ?? '').toLowerCase();
  if (!base) {
    const typed = stringOf(event.key).toLowerCase();
    base = SYMBOL_KEYS[typed] ?? (event.key ?? '').toLowerCase();
  }
  base = normalize(base);
  if (!base) return '';
  const modifiers = [event.ctrlKey && MODIFIER.ctrl, event.altKey && MODIFIER.alt, event.shiftKey && MODIFIER.shift].filter(Boolean);
  return [...modifiers, base].join(KEY_SEPARATOR);
}

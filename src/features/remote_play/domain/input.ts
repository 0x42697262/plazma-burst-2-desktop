import { MAX_KEY_TEXT, MODIFIER_BIT, NO_MODIFIERS } from '../constants.ts';
import { BUTTON_NAMES, ELECTRON_KEY_NAMES, EMPTY_KEY, FIRST_PRINTABLE, INPUT_EVENT, KEY_CODE_PATTERN, MESSAGE, MODIFIER_NAME, NUMPAD_PREFIX } from '../keys.ts';
import { isBlockedKey } from './blocked-keys.ts';

export type StreamSize = { width: number; height: number };
export type InputEvent = Readonly<Record<string, unknown>> & { type: string };
type Message = Readonly<Record<string, unknown>>;

export function electronKey(code: string): string | null {
  const named = ELECTRON_KEY_NAMES[code];
  if (named) return named;
  const letter = KEY_CODE_PATTERN.letter.exec(code)?.[1];
  if (letter) return letter;
  const digit = KEY_CODE_PATTERN.digit.exec(code)?.[1];
  if (digit) return digit;
  const numpadDigit = KEY_CODE_PATTERN.numpad.exec(code)?.[1];
  if (numpadDigit) return NUMPAD_PREFIX + numpadDigit;
  return KEY_CODE_PATTERN.functionKey.test(code) ? code : null;
}

const modifierBits = (value: unknown): number => (Number.isInteger(value) ? value as number : NO_MODIFIERS);
const hasBit = (bits: number, bit: number): boolean => (bits & bit) !== 0;

function modifierNames(bits: number): string[] {
  const names: string[] = [];
  if (hasBit(bits, MODIFIER_BIT.shift)) names.push(MODIFIER_NAME.shift);
  if (hasBit(bits, MODIFIER_BIT.ctrl)) names.push(MODIFIER_NAME.control);
  if (hasBit(bits, MODIFIER_BIT.alt)) names.push(MODIFIER_NAME.alt);
  if (hasBit(bits, MODIFIER_BIT.meta)) names.push(MODIFIER_NAME.meta);
  return names;
}

const isKeyText = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= MAX_KEY_TEXT;
const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const clampTo = (value: number, size: number): number => Math.min(Math.max(Math.round(value), 0), size - 1);

function keyEvents(message: Message, bits: number, modifiers: string[]): InputEvent[] {
  const code = message.code;
  if (!isKeyText(code)) return [];
  const keyCode = electronKey(code);
  if (!keyCode) return [];
  const key = isKeyText(message.key) ? message.key : EMPTY_KEY;
  const press = { key, code, shift: hasBit(bits, MODIFIER_BIT.shift), ctrl: hasBit(bits, MODIFIER_BIT.ctrl), alt: hasBit(bits, MODIFIER_BIT.alt), meta: hasBit(bits, MODIFIER_BIT.meta) };
  if (isBlockedKey(press)) return [];
  if (message.t === MESSAGE.keyUp) return [{ type: INPUT_EVENT.keyUp, keyCode, modifiers }];
  const down = { type: INPUT_EVENT.keyDown, keyCode, modifiers: message.r ? [...modifiers, MODIFIER_NAME.autoRepeat] : modifiers };
  const isShortcut = hasBit(bits, MODIFIER_BIT.ctrl | MODIFIER_BIT.meta);
  const isTypedCharacter = [...key].length === 1 && !isShortcut && key >= FIRST_PRINTABLE;
  return isTypedCharacter ? [down, { type: INPUT_EVENT.char, keyCode: key, modifiers }] : [down];
}

function pointerEvents(message: Message, size: StreamSize, modifiers: string[]): InputEvent[] {
  const pointerX = clampTo(message.x as number, size.width);
  const pointerY = clampTo(message.y as number, size.height);
  if (message.t === MESSAGE.mouseMove) return [{ type: INPUT_EVENT.mouseMove, x: pointerX, y: pointerY, modifiers }];
  if (message.t === MESSAGE.mouseDown || message.t === MESSAGE.mouseUp) {
    const button = typeof message.b === 'number' ? BUTTON_NAMES[message.b] : undefined;
    if (!button) return [];
    const type = message.t === MESSAGE.mouseDown ? INPUT_EVENT.mouseDown : INPUT_EVENT.mouseUp;
    return [{ type, x: pointerX, y: pointerY, button, clickCount: 1, modifiers }];
  }
  if (message.t === MESSAGE.wheel) {
    if (!isFiniteNumber(message.dx) || !isFiniteNumber(message.dy)) return [];
    return [{ type: INPUT_EVENT.mouseWheel, x: pointerX, y: pointerY, deltaX: -message.dx, deltaY: -message.dy, canScroll: true, modifiers }];
  }
  return [];
}

export function toInputEvents(message: unknown, size: StreamSize | null): InputEvent[] {
  if (!message || typeof message !== 'object') return [];
  const fields = message as Message;
  const bits = modifierBits(fields.m);
  const modifiers = modifierNames(bits);
  if (fields.t === MESSAGE.keyDown || fields.t === MESSAGE.keyUp) return keyEvents(fields, bits, modifiers);
  if (!isFiniteNumber(fields.x) || !isFiniteNumber(fields.y) || !size) return [];
  return pointerEvents(fields, size, modifiers);
}

export function releaseAll(codes: Iterable<string>): InputEvent[] {
  const released: InputEvent[] = [];
  for (const code of codes) {
    const keyCode = electronKey(code);
    if (keyCode) released.push({ type: INPUT_EVENT.keyUp, keyCode, modifiers: [] });
  }
  return released;
}

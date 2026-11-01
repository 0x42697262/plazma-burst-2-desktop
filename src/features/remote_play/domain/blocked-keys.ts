import { BLOCKED_KEY } from '../keys.ts';

export type KeyPress = { key?: string; code?: string; ctrl?: boolean; meta?: boolean; shift?: boolean; alt?: boolean };
export type ElectronInput = { key: string; code: string; control: boolean; meta: boolean; shift: boolean; alt: boolean };

export function isBlockedKey({ key = '', code = '', ctrl = false, meta = false, shift = false }: KeyPress = {}): boolean {
  const keyName = key.toLowerCase();
  const hasCommandModifier = ctrl || meta;
  const isPaste = hasCommandModifier && (keyName === BLOCKED_KEY.paste || code === BLOCKED_KEY.pasteCode);
  const isShiftInsertPaste = shift && (keyName === BLOCKED_KEY.insert || code === BLOCKED_KEY.insertCode);
  const opensDevTools = hasCommandModifier && shift && BLOCKED_KEY.devTools.includes(keyName);
  const opensHostTool = hasCommandModifier && BLOCKED_KEY.hostTools.includes(keyName);
  return isPaste || isShiftInsertPaste || opensDevTools || opensHostTool;
}

export const fromElectronInput = (input: ElectronInput): KeyPress => ({ key: input.key, code: input.code, ctrl: input.control, meta: input.meta, shift: input.shift, alt: input.alt });

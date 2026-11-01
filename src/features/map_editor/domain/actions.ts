import { opcodeName, parseScript, type Script } from '#features/triggers/script.ts';
import { stringOf } from '#kernel/text/text-of.ts';
import { FIRST_ACTION_SLOT } from './constants.ts';
import {
  ACTION_PATTERN, ACTION_SIDE, EMPTY_TYPE, HEADER_PATTERN, NO_ACTIONS_PATTERN, TRIGGER_HEADERS, actionAttr, type ActionPart,
} from './keys.ts';
import { DOMAIN_TEXT as TEXT } from './text.ts';
import type { Attrs, AttrValues } from './doc.ts';

export { EMPTY_TYPE };

export type TriggerAction = { type: string | number; A: string; B: string };
type Slot = Partial<Record<ActionPart, string>>;

export const isActionAttr = (attr: string): boolean => ACTION_PATTERN.test(attr);

export function actionsOf(attrs: Attrs): TriggerAction[] {
  const slots = new Map<number, Slot>();
  for (const [attr, value] of Object.entries(attrs)) {
    const match = ACTION_PATTERN.exec(attr);
    if (!match) continue;
    const number = Number(match[1]);
    let slot = slots.get(number);
    if (!slot) {
      slot = {};
      slots.set(number, slot);
    }
    slot[match[2] as ActionPart] = value;
  }
  return [...slots.keys()].sort((first, second) => first - second).map((number) => slots.get(number) as Slot)
    .filter((slot) => slot.type !== undefined && slot.type !== EMPTY_TYPE)
    .map((slot) => ({ type: slot.type as string, A: slot.targetA ?? '', B: slot.targetB ?? '' }));
}

export function actionValues(attrs: Attrs, list: readonly TriggerAction[]): AttrValues {
  const values: AttrValues = {};
  for (const attr of Object.keys(attrs)) if (ACTION_PATTERN.test(attr)) values[attr] = undefined;
  list.forEach((action, index) => {
    const slot = index + FIRST_ACTION_SLOT;
    values[actionAttr(slot, ACTION_SIDE.type)] = String(action.type);
    values[actionAttr(slot, ACTION_SIDE.targetA)] = action.A;
    values[actionAttr(slot, ACTION_SIDE.targetB)] = action.B;
  });
  return values;
}

export function triggerText(attrs: Attrs): string {
  const lines = TRIGGER_HEADERS.filter((header) => attrs[header] !== undefined).map((header) => TEXT.headerLine(header, attrs[header] ?? ''));
  lines.push('');
  for (const action of actionsOf(attrs)) lines.push(TEXT.actionLine(opcodeName(Number(action.type)), action.A, action.B));
  return lines.join(TEXT.lineBreak);
}

function parseText(text: string): Script {
  try {
    return parseScript(text);
  } catch (error) {
    if (NO_ACTIONS_PATTERN.test((error as Error).message)) {
      const headers: Record<string, string> = {};
      for (const match of stringOf(text).matchAll(HEADER_PATTERN)) headers[(match[1] ?? '').toLowerCase()] = match[2] ?? '';
      return { headers, actions: [] };
    }
    throw error;
  }
}

export function valuesFromText(attrs: Attrs, text: string): AttrValues {
  const { headers, actions } = parseText(text);
  return { ...headers, ...actionValues(attrs, actions.map((action) => ({ type: action.type, A: action.A, B: action.B }))) };
}

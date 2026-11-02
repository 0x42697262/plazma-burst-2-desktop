import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { pluralSuffix } from '#console/kernel/core/words.ts';
import { GAME_FIELDS } from '#console/kernel/game/fields.ts';
import { ACTION_NAMES } from '#console/kernel/game/actions.ts';
import { requireLevel } from '#console/kernel/game/level.ts';
import { stringOf } from '#kernel/text/text-of.ts';
import { triggerList } from './model.ts';
import { actionInfo } from './script.ts';
import type { Trigger } from './types.ts';
import { NO_UID } from './entry/keys.ts';
import { TRIGGERS_TEXT as TEXT } from './entry/text.ts';

export type Triggers = (Trigger | null | undefined)[];

export const actionName = (type: number): string => TEXT.actionName(ACTION_NAMES[type] || actionInfo(type)?.desc);

export const disabledColor = (trigger: Trigger): string | undefined => (trigger[GAME_FIELDS.T_ENABLED] ? undefined : COLOR.muted);

export const actionWord = (count: number): string => TEXT.actionNoun + pluralSuffix(count);

export const actionCount = (trigger: Trigger): number => (trigger[GAME_FIELDS.T_ACTIONS] as number | undefined) || 0;

export const uidColumn = (trigger: Trigger, width: number): string => stringOf(trigger.uid || NO_UID).padEnd(width);

export function triggersOrNone(): Triggers | null {
  requireLevel();
  const list = triggerList();
  if (!list.length) {
    print(TEXT.noTriggers, COLOR.notice);
    return null;
  }
  return list;
}

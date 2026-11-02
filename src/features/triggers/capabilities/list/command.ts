import { print } from '#console/kernel/ui/log.ts';
import { showPaged, takePage, type Row } from '#console/kernel/ui/pager.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { plural } from '#console/kernel/core/words.ts';
import { GAME_FIELDS } from '#console/kernel/game/fields.ts';
import { stringOf } from '#kernel/text/text-of.ts';
import { actionsOf, showTarget, callsText, triggerLabel, findTrigger, triggerSources } from '../../model.ts';
import type { Trigger } from '../../types.ts';
import { ACTION_NUMBER_WIDTH, CALLS_WIDTH, INDEX_WIDTH, TRIGGER_UID_WIDTH, TYPE_WIDTH } from '../../entry/constants.ts';
import { FILTER_WORD, SPACE, TRIGGERS_COMMAND } from '../../entry/keys.ts';
import { TRIGGERS_TEXT as SHARED } from '../../entry/text.ts';
import { HELP, TEXT } from './text.ts';
import { actionCount, actionName, disabledColor, triggersOrNone, uidColumn, type Triggers } from '../../trigger-view.ts';

function showOne(list: Triggers, index: number, page: number): void {
  const trigger = list[index];
  if (!trigger) throw new Error(TEXT.noTrigger(index, list.length));
  const sources = triggerSources().get(index);
  const rows: Row[] = [...actionsOf(trigger)].map(({ n: action, type, A, B }) => [
    TEXT.actionRow(String(action).padStart(ACTION_NUMBER_WIDTH), String(type).padEnd(TYPE_WIDTH), showTarget(A), showTarget(B), actionName(type)),
  ]);
  print(TEXT.triggerTitle(triggerLabel(index, trigger)), COLOR.title);
  print(TEXT.state(!!trigger[GAME_FIELDS.T_ENABLED], callsText(trigger), !!trigger[GAME_FIELDS.T_AT_START]));
  print(TEXT.startedBy(sources ? sources.map((source) => source.text).join(SHARED.sourceSeparator) : null));
  showPaged({ title: TEXT.actionsTitle(plural(actionCount(trigger), SHARED.actionNoun)), color: COLOR.plain, rows, cmd: TEXT.triggerCommand(index), page });
}

function passesFilter(trigger: Trigger, filter: string): boolean {
  const enabled = !!trigger[GAME_FIELDS.T_ENABLED];
  if (filter === FILTER_WORD.on) return enabled;
  if (filter === FILTER_WORD.off) return !enabled;
  return !filter || stringOf(trigger.uid).toLowerCase().includes(filter);
}

function listTriggers(rawArgs: readonly string[]): void {
  const list = triggersOrNone();
  if (!list) return;
  const { args, page } = takePage(rawArgs);
  const query = args.join(SPACE).trim();
  const filter = query.toLowerCase();
  const index = findTrigger(list, query);
  if (index >= 0) {
    showOne(list, index, page);
    return;
  }
  const sources = triggerSources();
  const enabledCount = list.filter((trigger) => trigger?.[GAME_FIELDS.T_ENABLED]).length;
  const rows: Row[] = [];
  list.forEach((trigger, position) => {
    if (!trigger || !passesFilter(trigger, filter)) return;
    const by = sources.get(position);
    const flags = [trigger[GAME_FIELDS.T_AT_START] ? TEXT.atStart : '', by?.[0] ? TEXT.by(by[0].text, by.length - 1) : ''].filter(Boolean).join(SHARED.flagSeparator);
    const count = actionCount(trigger);
    rows.push([TEXT.listRow(String(position).padEnd(INDEX_WIDTH), uidColumn(trigger, TRIGGER_UID_WIDTH), !!trigger[GAME_FIELDS.T_ENABLED], callsText(trigger).padEnd(CALLS_WIDTH), String(count).padStart(ACTION_NUMBER_WIDTH), count === 1, flags), disabledColor(trigger)]);
  });
  const empty = filter === FILTER_WORD.on ? TEXT.noEnabled : filter === FILTER_WORD.off ? TEXT.noDisabled : TEXT.noMatch(query);
  showPaged({ title: TEXT.listTitle(list.length, enabledCount, query, rows.length), rows, cmd: TEXT.listCommand(query), empty, page });
}

export const listCommand = Object.freeze({
  parent: TRIGGERS_COMMAND.name,
  ownRun: true,
  usage: HELP.usage,
  desc: HELP.desc,
  help: HELP.help,
  run: (args: string[]) => { listTriggers(args); },
});

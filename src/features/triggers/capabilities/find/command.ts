import { showPaged, takePage, type Row } from '#console/kernel/ui/pager.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { plural } from '#console/kernel/core/words.ts';
import { GAME_FIELDS } from '#console/kernel/game/fields.ts';
import { actionsOf, showTarget, callsText, triggerSources, sourcesOf } from '../../model.ts';
import { ACTION_NUMBER_WIDTH, CALLS_WIDTH, FIND_UID_WIDTH, INDEX_WIDTH, ONE_TRIGGER, SOURCES_SHOWN, TYPE_WIDTH } from '../../entry/constants.ts';
import { FIELD, SPACE, TRIGGERS_COMMAND, TRIGGER_FIELDS } from '../../entry/keys.ts';
import { TRIGGERS_TEXT as SHARED } from '../../entry/text.ts';
import { HELP, TEXT } from './text.ts';
import { COMMAND } from './keys.ts';
import { BY_WORD_LIST, actionMatches, bySources, countOf, parseTerms, uidMatches } from './trigger-search.ts';
import { actionCount, actionName, actionWord, disabledColor, triggersOrNone, uidColumn } from '../../trigger-view.ts';

function find(rawArgs: readonly string[]): void {
  const list = triggersOrNone();
  if (!list) return;
  const { args, page } = takePage(rawArgs);
  if (!args.length) throw new Error(TEXT.findUsage);
  const terms = parseTerms(args, TEXT.findUsage);
  const uidTerms = terms.filter((term) => term.field === FIELD.uid);
  const byTerms = terms.filter((term) => term.field === FIELD.by);
  const countTerms = terms.filter((term) => term.field === FIELD.calls || term.field === FIELD.maxcalls);
  const actionTerms = terms.filter((term) => !TRIGGER_FIELDS.has(term.field));
  const sources = byTerms.length ? triggerSources() : null;
  const triggerRows: Row[] = [];
  const actionRows: Row[] = [];
  const triggersHit = new Set<number>();
  list.forEach((trigger, index) => {
    if (!trigger) return;
    if (!uidTerms.every((term) => uidMatches(trigger, term))) return;
    if (!countTerms.every((term) => term.compare?.(countOf(trigger, term.field), term.value ?? 0))) return;
    const triggerSourceList = sources ? sourcesOf(sources, index, trigger) : [];
    const byHits = byTerms.map((term) => bySources(triggerSourceList, term));
    if (byHits.includes(null)) return;
    const onlyUidMatches = actionTerms.every((term) => term.field === FIELD.any && uidMatches(trigger, term));
    if (onlyUidMatches) {
      const count = actionCount(trigger);
      const how = [...new Set(byHits.flatMap((hit) => hit ?? []).map((source) => source.text))];
      const shown = TEXT.moreSources(how.slice(0, SOURCES_SHOWN).join(SHARED.sourceSeparator), how.length - SOURCES_SHOWN);
      triggerRows.push([TEXT.findTriggerRow(String(index).padEnd(INDEX_WIDTH), uidColumn(trigger, FIND_UID_WIDTH), !!trigger[GAME_FIELDS.T_ENABLED], callsText(trigger).padEnd(CALLS_WIDTH), String(count).padStart(ACTION_NUMBER_WIDTH), actionWord(count), how.length ? shown : ''), disabledColor(trigger)]);
    }
    if (!actionTerms.length) return;
    for (const action of actionsOf(trigger)) {
      if (!actionTerms.every((term) => actionMatches(action, term))) continue;
      triggersHit.add(index);
      actionRows.push([TEXT.findActionRow(String(index).padEnd(INDEX_WIDTH), uidColumn(trigger, FIND_UID_WIDTH), String(action.n).padEnd(ACTION_NUMBER_WIDTH), String(action.type).padEnd(TYPE_WIDTH), showTarget(action.A), showTarget(action.B), actionName(action.type)), disabledColor(trigger)]);
    }
  });
  const rows = triggerRows.concat(actionRows);
  const query = args.join(SPACE);
  const parts: string[] = [];
  if (triggerRows.length) parts.push(TEXT.triggersByUid(plural(triggerRows.length, SHARED.triggerNoun), !byTerms.length && !countTerms.length));
  if (actionRows.length) parts.push(TEXT.actionsIn(plural(actionRows.length, SHARED.actionNoun), plural(triggersHit.size, SHARED.triggerNoun)));
  showPaged({
    title: rows.length ? TEXT.findTitle(parts.join(SHARED.flagSeparator), rows.length === ONE_TRIGGER, query) : TEXT.findNothing(query),
    color: rows.length ? COLOR.title : COLOR.notice,
    rows,
    cmd: TEXT.findCommand(query),
    page,
  });
}

export const findCommand = Object.freeze({
  parent: TRIGGERS_COMMAND.name,
  name: COMMAND.name,
  aliases: COMMAND.aliases,
  usage: HELP.usage,
  desc: HELP.desc,
  help: { about: HELP.about, args: HELP.args(BY_WORD_LIST), examples: HELP.examples, notes: HELP.notes, see: HELP.see },
  run: (args: string[]) => { find(args); },
});

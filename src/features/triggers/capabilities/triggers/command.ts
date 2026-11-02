import { CAPABILITY } from '#shared/features/keys.ts';
import { print } from '#console/kernel/ui/log.ts';
import { showPaged, takePage, type Row } from '#console/kernel/ui/pager.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { plural, pluralSuffix, agoText, parseIndex } from '#console/kernel/core/words.ts';
import { takeOptions } from '#console/kernel/core/args.ts';
import { game } from '#console/kernel/game/bindings.ts';
import { GAME_FIELDS } from '#console/kernel/game/fields.ts';
import { ACTION_NAMES } from '#console/kernel/game/actions.ts';
import { requireLevel, charLabel } from '#console/kernel/game/level.ts';
import { KEY } from '#console/kernel/state/schema.ts';
import { settings } from '#console/kernel/state/store.ts';
import type { CommandContext, CommandDefinition } from '#console/kernel/commands/registry.ts';
import { stringOf } from '#kernel/text/text-of.ts';
import { triggerList, actionsOf, showTarget, callsText, triggerLabel, findTrigger, triggerSources, sourcesOf } from '../../model.ts';
import { triggerRuns, clearTriggerRuns, TRIG_HISTORY_MAX } from '../../run-log.ts';
import { takeRunOptions, runTriggerAs, reportRun, SHOT_POWER, resolveActions, runScript } from '../../run.ts';
import { parseScript, actionInfo, opcodeName, opcodesLoaded, searchActions } from '../../script.ts';
import type { Trigger } from '../../types.ts';
import {
  ACTION_NUMBER_WIDTH, ALIAS_WIDTH, CALLS_WIDTH, FIND_UID_WIDTH, HISTORY_AGO_WIDTH, HISTORY_INDEX_WIDTH, INDEX_WIDTH, ONE_TRIGGER, SOURCES_SHOWN, TRIGGER_UID_WIDTH,
  TYPE_WIDTH, WHO_WIDTH,
} from '../../entry/constants.ts';
import {
  EXEC_OPTION, EXEC_OPTIONS, FIELD, FILTER_WORD, FIRST_WORD, LEADING_OPTIONS, NO_UID, SINGLE_WORD, SPACE, TRIGGERS_COMMAND, TRIGGER_FIELDS, TRUE_TEXT, YOU,
} from '../../entry/keys.ts';
import { TRIGGERS_HELP as HELP, TRIGGERS_TEXT as TEXT } from '../../entry/text.ts';
import { BY_WORD_LIST, actionMatches, bySources, countOf, parseTerms, uidMatches } from '../../entry/trigger-search.ts';

type Triggers = (Trigger | null | undefined)[];

const actionName = (type: number): string => TEXT.actionName(ACTION_NAMES[type] || actionInfo(type)?.desc);
const disabledColor = (trigger: Trigger): string | undefined => (trigger[GAME_FIELDS.T_ENABLED] ? undefined : COLOR.muted);
const actionWord = (count: number): string => TEXT.actionNoun + pluralSuffix(count);
const actionCount = (trigger: Trigger): number => (trigger[GAME_FIELDS.T_ACTIONS] as number | undefined) || 0;
const uidColumn = (trigger: Trigger, width: number): string => stringOf(trigger.uid || NO_UID).padEnd(width);

function triggersOrNone(): Triggers | null {
  requireLevel();
  const list = triggerList();
  if (!list.length) {
    print(TEXT.noTriggers, COLOR.notice);
    return null;
  }
  return list;
}

function showOne(list: Triggers, index: number, page: number): void {
  const trigger = list[index];
  if (!trigger) throw new Error(TEXT.noTrigger(index, list.length));
  const sources = triggerSources().get(index);
  const rows: Row[] = [...actionsOf(trigger)].map(({ n: action, type, A, B }) => [
    TEXT.actionRow(String(action).padStart(ACTION_NUMBER_WIDTH), String(type).padEnd(TYPE_WIDTH), showTarget(A), showTarget(B), actionName(type)),
  ]);
  print(TEXT.triggerTitle(triggerLabel(index, trigger)), COLOR.title);
  print(TEXT.state(!!trigger[GAME_FIELDS.T_ENABLED], callsText(trigger), !!trigger[GAME_FIELDS.T_AT_START]));
  print(TEXT.startedBy(sources ? sources.map((source) => source.text).join(TEXT.sourceSeparator) : null));
  showPaged({ title: TEXT.actionsTitle(plural(actionCount(trigger), TEXT.actionNoun)), color: COLOR.plain, rows, cmd: TEXT.triggerCommand(index), page });
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
    const flags = [trigger[GAME_FIELDS.T_AT_START] ? TEXT.atStart : '', by?.[0] ? TEXT.by(by[0].text, by.length - 1) : ''].filter(Boolean).join(TEXT.flagSeparator);
    const count = actionCount(trigger);
    rows.push([TEXT.listRow(String(position).padEnd(INDEX_WIDTH), uidColumn(trigger, TRIGGER_UID_WIDTH), !!trigger[GAME_FIELDS.T_ENABLED], callsText(trigger).padEnd(CALLS_WIDTH), String(count).padStart(ACTION_NUMBER_WIDTH), count === 1, flags), disabledColor(trigger)]);
  });
  const empty = filter === FILTER_WORD.on ? TEXT.noEnabled : filter === FILTER_WORD.off ? TEXT.noDisabled : TEXT.noMatch(query);
  showPaged({ title: TEXT.listTitle(list.length, enabledCount, query, rows.length), rows, cmd: TEXT.listCommand(query), empty, page });
}

function showHistory(rawArgs: readonly string[]): void {
  if (!triggersOrNone()) return;
  const { args, page } = takePage(rawArgs);
  const query = args.join(SPACE).trim().toLowerCase();
  const runs = triggerRuns();
  if (query === FILTER_WORD.clear) {
    clearTriggerRuns();
    print(TEXT.historyCleared, COLOR.ok);
    return;
  }
  if (!settings.effective(KEY.TRIGGER_HISTORY)) print(TEXT.historyOff(KEY.TRIGGER_HISTORY), COLOR.notice);
  const showsAll = query === FILTER_WORD.all;
  const byIndex = parseIndex(query) ?? -1;
  const now = performance.now();
  const me = game.me();
  const rows: Row[] = [];
  let refused = 0;
  for (let position = runs.length - 1; position >= 0; position--) {
    const run = runs[position];
    if (!run) continue;
    if (!run.ok) refused++;
    if (!run.ok && !showsAll && byIndex < 0) continue;
    if (byIndex >= 0 && run.idx !== byIndex) continue;
    if (query && !showsAll && byIndex < 0 && !stringOf(run.uid || '').toLowerCase().includes(query)) continue;
    const who = typeof run.by !== 'number' || run.by < 0 ? TEXT.noActivator : run.by === me ? YOU : charLabel(run.by);
    const result = run.ok ? TEXT.ran : TEXT.refused(run.why);
    rows.push([TEXT.historyRow(agoText(now - run.last).padEnd(HISTORY_AGO_WIDTH), String(run.idx).padEnd(HISTORY_INDEX_WIDTH), stringOf(run.uid || NO_UID).padEnd(TRIGGER_UID_WIDTH), who.padEnd(WHO_WIDTH), result, run.count), run.ok ? undefined : COLOR.muted]);
  }
  const hidden = !showsAll && byIndex < 0 && refused ? TEXT.refusedHidden(plural(refused, TEXT.refusedNoun)) : '';
  showPaged({
    title: TEXT.historyTitle(runs.length, TRIG_HISTORY_MAX, hidden),
    rows,
    cmd: TEXT.historyCommand(query),
    empty: query && query !== FILTER_WORD.all ? TEXT.historyNoMatch(query) : TEXT.historyEmpty,
    hint: TEXT.historyHint,
    page,
  });
}

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
      const shown = TEXT.moreSources(how.slice(0, SOURCES_SHOWN).join(TEXT.sourceSeparator), how.length - SOURCES_SHOWN);
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
  if (triggerRows.length) parts.push(TEXT.triggersByUid(plural(triggerRows.length, TEXT.triggerNoun), !byTerms.length && !countTerms.length));
  if (actionRows.length) parts.push(TEXT.actionsIn(plural(actionRows.length, TEXT.actionNoun), plural(triggersHit.size, TEXT.triggerNoun)));
  showPaged({
    title: rows.length ? TEXT.findTitle(parts.join(TEXT.flagSeparator), rows.length === ONE_TRIGGER, query) : TEXT.findNothing(query),
    color: rows.length ? COLOR.title : COLOR.notice,
    rows,
    cmd: TEXT.findCommand(query),
    page,
  });
}

function runOne(args: readonly string[]): void {
  const list = triggersOrNone();
  if (!list) return;
  const { rest, force, activator } = takeRunOptions(args, TEXT.runUsage);
  const [query] = rest;
  if (rest.length !== 1 || query === undefined) throw new Error(TEXT.runUsage);
  const index = findTrigger(list, query);
  const trigger = list[index];
  if (index < 0 || !trigger) throw new Error(TEXT.noSuchTrigger(query));
  const outcome = runTriggerAs(index, trigger, { force, activator, power: SHOT_POWER, forceHint: TEXT.runForceHint(index) });
  reportRun(TEXT.ranTrigger(outcome.label), trigger, activator, outcome);
}

function scriptText(rest: string): { options: Set<string>; script: string } {
  const text = rest.replace(FIRST_WORD, '');
  const words = LEADING_OPTIONS.exec(text)?.[0] ?? '';
  const { options } = takeOptions(words.split(/\s+/).filter(Boolean), EXEC_OPTIONS);
  return { options, script: text.slice(words.length) };
}

function headerRefusal(headers: Readonly<Record<string, string>>): string {
  if (headers.enabled !== undefined && headers.enabled !== TRUE_TEXT) return TEXT.headerEnabled(headers.enabled);
  if (headers.maxcalls !== undefined && Number(headers.maxcalls) === 0) return TEXT.headerMaxCalls;
  return '';
}

function execScript(_args: readonly string[], { rest }: CommandContext): void {
  const { options, script } = scriptText(rest);
  const trimmed = script.trim();
  if (!trimmed) throw new Error(TEXT.execUsage);
  if (SINGLE_WORD.test(trimmed) && findTrigger(triggerList(), trimmed) >= 0) throw new Error(TEXT.runsMapTrigger(trimmed));
  const { headers, actions } = parseScript(script);
  requireLevel();
  const resolved = resolveActions(actions);
  const label = TEXT.pastedLabel(headers.uid);
  if (options.has(EXEC_OPTION.check)) {
    print(TEXT.checked(label, plural(actions.length, TEXT.actionNoun)), COLOR.title);
    for (const action of resolved) print(TEXT.checkedRow(String(action.line).padStart(ACTION_NUMBER_WIDTH), opcodeName(action.type), action.type, showTarget(action.A), showTarget(action.B), actionName(action.type)));
    return;
  }
  const refusal = headerRefusal(headers);
  if (refusal && !options.has(EXEC_OPTION.force)) throw new Error(TEXT.notRun(refusal));
  runScript(resolved, { activator: game.me(), uid: headers.uid });
  print(TEXT.ranPasted(label, plural(actions.length, TEXT.actionNoun)), COLOR.ok);
  if (game.isMP()) print(TEXT.pastedLocalOnly, COLOR.warn);
}

function listActions(rawArgs: readonly string[]): void {
  if (!opcodesLoaded()) throw new Error(TEXT.noOpcodes);
  const { args, page } = takePage(rawArgs);
  const query = args.join(SPACE).trim();
  const hits = searchActions(query);
  const rows: Row[] = hits.map((action) => [TEXT.actionsRow(String(action.type).padStart(TYPE_WIDTH), (action.alias || TEXT.opName(action.type)).padEnd(ALIAS_WIDTH), action.desc, action.a, action.b)]);
  showPaged({ title: TEXT.actionsTitle2(query, hits.length), rows, cmd: TEXT.actionsCommand(query), empty: TEXT.actionsNoMatch(query), page });
}

export const triggersCommand: CommandDefinition = {
  name: TRIGGERS_COMMAND.name,
  capability: CAPABILITY.triggers.list,
  aliases: TRIGGERS_COMMAND.aliases,
  usage: HELP.usage,
  desc: HELP.desc,
  help: HELP.help,
  run: (args) => { listTriggers(args); },
  subcommands: [
    {
      name: TRIGGERS_COMMAND.history,
      capability: CAPABILITY.triggers.history,
      aliases: TRIGGERS_COMMAND.historyAliases,
      usage: HELP.history.usage,
      desc: HELP.history.desc,
      help: { about: HELP.history.about, args: HELP.history.args, examples: HELP.history.examples, notes: HELP.history.notes(TRIG_HISTORY_MAX), see: HELP.history.see },
      run: (args) => { showHistory(args); },
    },
    {
      name: TRIGGERS_COMMAND.find,
      capability: CAPABILITY.triggers.find,
      aliases: TRIGGERS_COMMAND.findAliases,
      usage: HELP.find.usage,
      desc: HELP.find.desc,
      help: { about: HELP.find.about, args: HELP.find.args(BY_WORD_LIST), examples: HELP.find.examples, notes: HELP.find.notes, see: HELP.find.see },
      run: (args) => { find(args); },
    },
    {
      name: TRIGGERS_COMMAND.run,
      capability: CAPABILITY.triggers.run,
      aliases: TRIGGERS_COMMAND.runAliases,
      usage: HELP.run.usage,
      desc: HELP.run.desc,
      reportsReach: true,
      help: { about: HELP.run.about, args: HELP.run.args, examples: HELP.run.examples, notes: HELP.run.notes, see: HELP.run.see },
      run: (args) => { runOne(args); },
    },
    {
      name: TRIGGERS_COMMAND.exec,
      capability: CAPABILITY.triggers.exec,
      aliases: TRIGGERS_COMMAND.execAliases,
      usage: HELP.exec.usage,
      desc: HELP.exec.desc,
      rawLine: true,
      reportsReach: true,
      help: { about: HELP.exec.about, args: HELP.exec.args, examples: HELP.exec.examples, notes: HELP.exec.notes, see: HELP.exec.see },
      run: (args, context) => { execScript(args, context); },
    },
    {
      name: TRIGGERS_COMMAND.actions,
      capability: CAPABILITY.triggers.actions,
      aliases: TRIGGERS_COMMAND.actionsAliases,
      usage: HELP.actions.usage,
      desc: HELP.actions.desc,
      help: { about: HELP.actions.about, args: HELP.actions.args, examples: HELP.actions.examples, see: HELP.actions.see },
      run: (args) => { listActions(args); },
    },
  ],
};

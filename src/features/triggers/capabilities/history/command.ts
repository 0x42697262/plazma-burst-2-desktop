import { print } from '#console/kernel/ui/log.ts';
import { showPaged, takePage, type Row } from '#console/kernel/ui/pager.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { plural, agoText, parseIndex } from '#console/kernel/core/words.ts';
import { game } from '#console/kernel/game/bindings.ts';
import { charLabel } from '#console/kernel/game/level.ts';
import { SETTING } from '#features/triggers/keys.ts';
import { settings } from '#console/kernel/state/store.ts';
import { stringOf } from '#kernel/text/text-of.ts';
import { triggerRuns, clearTriggerRuns, TRIG_HISTORY_MAX } from '../../run-log.ts';
import { HISTORY_AGO_WIDTH, HISTORY_INDEX_WIDTH, TRIGGER_UID_WIDTH, WHO_WIDTH } from '../../entry/constants.ts';
import { FILTER_WORD, NO_UID, SPACE, TRIGGERS_COMMAND, YOU } from '../../entry/keys.ts';
import { HELP, TEXT } from './text.ts';
import { COMMAND } from './keys.ts';
import { triggersOrNone } from '../../trigger-view.ts';

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
  if (!settings.effective(SETTING.triggerHistory)) print(TEXT.historyOff(SETTING.triggerHistory), COLOR.notice);
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

export const historyCommand = Object.freeze({
  parent: TRIGGERS_COMMAND.name,
  name: COMMAND.name,
  aliases: COMMAND.aliases,
  usage: HELP.usage,
  desc: HELP.desc,
  help: { about: HELP.about, args: HELP.args, examples: HELP.examples, notes: HELP.notes(TRIG_HISTORY_MAX), see: HELP.see },
  run: (args: string[]) => { showHistory(args); },
});

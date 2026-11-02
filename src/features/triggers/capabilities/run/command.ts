import { findTrigger } from '../../model.ts';
import { takeRunOptions, runTriggerAs, reportRun, SHOT_POWER } from '../../run.ts';
import { TRIGGERS_COMMAND } from '../../entry/keys.ts';
import { HELP, TEXT } from './text.ts';
import { COMMAND } from './keys.ts';
import { triggersOrNone } from '../../trigger-view.ts';

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

export const runCommand = Object.freeze({
  parent: TRIGGERS_COMMAND.name,
  name: COMMAND.name,
  aliases: COMMAND.aliases,
  usage: HELP.usage,
  desc: HELP.desc,
  reportsReach: true,
  help: { about: HELP.about, args: HELP.args, examples: HELP.examples, notes: HELP.notes, see: HELP.see },
  run: (args: string[]) => { runOne(args); },
});

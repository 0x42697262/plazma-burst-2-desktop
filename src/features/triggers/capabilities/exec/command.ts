import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { plural } from '#console/kernel/core/words.ts';
import { takeOptions } from '#console/kernel/core/args.ts';
import { game } from '#console/kernel/game/bindings.ts';
import { requireLevel } from '#console/kernel/game/level.ts';
import type { CommandContext } from '#console/kernel/commands/registry.ts';
import { triggerList, showTarget, findTrigger } from '../../model.ts';
import { resolveActions, runScript } from '../../run.ts';
import { parseScript, opcodeName } from '../../script.ts';
import { ACTION_NUMBER_WIDTH } from '../../entry/constants.ts';
import { EXEC_OPTION, EXEC_OPTIONS, FIRST_WORD, LEADING_OPTIONS, SINGLE_WORD, TRIGGERS_COMMAND, TRUE_TEXT } from '../../entry/keys.ts';
import { TRIGGERS_TEXT as SHARED } from '../../entry/text.ts';
import { HELP, TEXT } from './text.ts';
import { COMMAND } from './keys.ts';
import { actionName } from '../../trigger-view.ts';

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
    print(TEXT.checked(label, plural(actions.length, SHARED.actionNoun)), COLOR.title);
    for (const action of resolved) print(TEXT.checkedRow(String(action.line).padStart(ACTION_NUMBER_WIDTH), opcodeName(action.type), action.type, showTarget(action.A), showTarget(action.B), actionName(action.type)));
    return;
  }
  const refusal = headerRefusal(headers);
  if (refusal && !options.has(EXEC_OPTION.force)) throw new Error(TEXT.notRun(refusal));
  runScript(resolved, { activator: game.me(), uid: headers.uid });
  print(TEXT.ranPasted(label, plural(actions.length, SHARED.actionNoun)), COLOR.ok);
  if (game.isMP()) print(TEXT.pastedLocalOnly, COLOR.warn);
}

export const execCommand = Object.freeze({
  parent: TRIGGERS_COMMAND.name,
  name: COMMAND.name,
  aliases: COMMAND.aliases,
  usage: HELP.usage,
  desc: HELP.desc,
  rawLine: true,
  reportsReach: true,
  help: { about: HELP.about, args: HELP.args, examples: HELP.examples, notes: HELP.notes, see: HELP.see },
  run: (args: string[], context: CommandContext) => { execScript(args, context); },
});

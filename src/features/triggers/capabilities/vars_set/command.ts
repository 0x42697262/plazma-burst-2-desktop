import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import type { CommandContext } from '#console/kernel/commands/registry.ts';
import { requireVars, showVar, parseVarValue, noteVarEdit } from '../../vars.ts';
import { NAME_AND_VALUE, SINGLE_ARGUMENT } from '../../entry/constants.ts';
import { SPACE, VARS_COMMAND, WRITE_VERBS } from '../../entry/keys.ts';
import { TEXT } from './text.ts';
import { COMMAND } from './keys.ts';

function writeVar(args: readonly string[], { verb }: CommandContext): void {
  const vars = requireVars();
  const [name] = args;
  if (!name) throw new Error(TEXT.writeUsage);
  const had = Object.hasOwn(vars, name);
  const before = vars[name];
  const action = WRITE_VERBS[(verb ?? WRITE_VERBS.set) as keyof typeof WRITE_VERBS];
  if (action === WRITE_VERBS.get) {
    if (args.length !== SINGLE_ARGUMENT) throw new Error(TEXT.writeUsage);
    if (!had) throw new Error(TEXT.noVariable(name));
    print(TEXT.value(name, showVar(before)));
    return;
  }
  if (action === WRITE_VERBS.del) {
    if (args.length !== SINGLE_ARGUMENT) throw new Error(TEXT.writeUsage);
    if (!had) {
      print(TEXT.notSet(name), COLOR.notice);
      return;
    }
    Reflect.deleteProperty(vars, name);
    noteVarEdit(vars, name, before);
    print(TEXT.removed(name, showVar(before)), COLOR.ok);
    return;
  }
  if (args.length < NAME_AND_VALUE) throw new Error(TEXT.writeUsage);
  const value = parseVarValue(args.slice(1).join(SPACE));
  vars[name] = value;
  noteVarEdit(vars, name, before);
  print(TEXT.changed(name, showVar(value), had ? showVar(before) : null), COLOR.ok);
  if (!had) print(TEXT.nothingReads, COLOR.hint);
}

export const varsSetCommand = Object.freeze({
  parent: VARS_COMMAND.name,
  name: COMMAND.name,
  aliases: COMMAND.aliases,
  usage: TEXT.set.usage,
  desc: TEXT.set.desc,
  help: { about: TEXT.set.about, args: TEXT.set.args, examples: TEXT.set.examples, notes: TEXT.set.notes, see: TEXT.set.see },
  run: (args: string[], context: CommandContext) => { writeVar(args, context); },
});

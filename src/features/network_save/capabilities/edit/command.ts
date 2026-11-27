import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import type { CommandContext } from '#console/kernel/commands/registry.ts';
import { COMMAND, EDIT_VERBS, FIELD_COUNT_ARGS, SUBCOMMAND, WORD_SEPARATOR } from '../../keys.ts';
import { BACKUP_TEXT } from '../../text.ts';
import { gameSave } from '../../adapters/game.ts';
import { backupLocal } from '../../services/backup.ts';
import { fieldShown, isProtectedField, isStorableText, parseFieldValue, uploadSkipsName, uploadSkipsValue } from '../../domain/fields.ts';
import { TEXT } from './text.ts';

const VERB_OF: Readonly<Record<string, string>> = Object.freeze({
  [EDIT_VERBS.set]: EDIT_VERBS.set, [EDIT_VERBS.get]: EDIT_VERBS.get,
  [EDIT_VERBS.del]: EDIT_VERBS.del, [EDIT_VERBS.unset]: EDIT_VERBS.del, [EDIT_VERBS.rm]: EDIT_VERBS.del,
});

let isBackedUp = false;

async function backupOnce(): Promise<boolean> {
  if (isBackedUp) return true;
  try {
    print(TEXT.kept(await backupLocal(gameSave.loginParams().login, BACKUP_TEXT.beforeEdits)), COLOR.hint);
    isBackedUp = true;
    return true;
  } catch (error) {
    print(TEXT.backupFailed((error as Error).message), COLOR.error);
    return false;
  }
}

async function change(apply: () => void): Promise<boolean> {
  if (!await backupOnce()) return false;
  apply();
  gameSave.saveFlush();
  return true;
}

function editField(args: readonly string[], { verb }: CommandContext): Promise<void> | void {
  const action = VERB_OF[String(verb ?? EDIT_VERBS.set).toLowerCase()] ?? EDIT_VERBS.set;
  const [name] = args;
  if (!name) throw new Error(TEXT.usageError);
  const data = gameSave.saveData();
  const had = Object.hasOwn(data, name);
  const before = data[name];
  if (action === EDIT_VERBS.get) {
    if (args.length !== FIELD_COUNT_ARGS.one) throw new Error(TEXT.usageError);
    if (!had) throw new Error(TEXT.noField(name));
    print(TEXT.value(name, fieldShown(name, before)));
    return;
  }
  if (isProtectedField(name)) throw new Error(TEXT.locked(name));
  if (action === EDIT_VERBS.del) {
    if (args.length !== FIELD_COUNT_ARGS.one) throw new Error(TEXT.usageError);
    if (!had) {
      print(TEXT.notSet(name), COLOR.notice);
      return;
    }
    return change(() => { Reflect.deleteProperty(data, name); }).then((isDone) => {
      if (isDone) print(TEXT.removed(name, fieldShown(name, before)), COLOR.ok);
    });
  }
  if (args.length < FIELD_COUNT_ARGS.nameAndValue) throw new Error(TEXT.usageError);
  const text = args.slice(1).join(WORD_SEPARATOR);
  if (!isStorableText(text)) throw new Error(TEXT.notStorable(text));
  const value = parseFieldValue(text);
  return change(() => { data[name] = value; }).then((isDone) => {
    if (!isDone) return;
    print(TEXT.changed(name, fieldShown(name, value), had ? fieldShown(name, before) : null), COLOR.ok);
    if (uploadSkipsName(name) || uploadSkipsValue(value)) print(TEXT.localOnly, COLOR.warn);
  });
}

export const editCommand = Object.freeze({
  parent: COMMAND.name,
  name: SUBCOMMAND.set,
  aliases: Object.freeze([EDIT_VERBS.get, EDIT_VERBS.del, EDIT_VERBS.unset, EDIT_VERBS.rm]),
  usage: TEXT.usage,
  desc: TEXT.desc,
  help: { about: TEXT.about, args: TEXT.args, examples: TEXT.examples },
  run: (args: string[], context: CommandContext) => editField(args, context),
});

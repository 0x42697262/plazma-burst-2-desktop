import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { COMMAND } from '../../keys.ts';
import { BIND_MIN_ARGUMENTS, UNSET_ARGUMENTS } from '../../constants.ts';
import { profileContext as context, profileStore as profiles } from '../../adapters/store.ts';
import { TEXT as SHARED_TEXT } from '../../text.ts';
import { isNone, requireProfile } from '../../services/profile-view.ts';
import { BIND_COMMAND, BIND_KEY_ARGUMENT } from './keys.ts';
import { BIND_TEXT as TEXT } from './text.ts';

type Args = readonly string[];

function bind(args: Args): void {
  const [name, word] = args;
  if (args.length < BIND_MIN_ARGUMENTS || !name || !word) throw new Error(TEXT.bindUsage);
  if (isNone(name)) throw new Error(SHARED_TEXT.noneIsReserved);
  const key = context.parseKeyName(word);
  const old = profiles.exists(name) ? profiles.get(name).binds[key] : undefined;
  if (args.length === BIND_MIN_ARGUMENTS) {
    print(old ? TEXT.bindShown(name, context.showKey(key), old) : TEXT.doesNotBind(name, context.showKey(key)), old ? undefined : COLOR.notice);
    return;
  }
  const command = context.commandText(args.slice(BIND_MIN_ARGUMENTS), TEXT.bindUsage);
  profiles.bind(name, key, command);
  print(TEXT.bindDone(name, context.showKey(key), command, old), COLOR.ok);
  print(TEXT.bindWhere(name, profiles.mapsUsing(name), context.showKey(key)), COLOR.hint);
  context.warnKeyUses(key);
}

function unbind(args: Args): void {
  if (args.length !== UNSET_ARGUMENTS) throw new Error(TEXT.unbindUsage);
  const name = requireProfile(args[0]);
  const key = context.parseKeyName(args[1] ?? '');
  const old = profiles.get(name).binds[key];
  if (!old) {
    print(TEXT.doesNotBind(name, context.showKey(key)), COLOR.notice);
    return;
  }
  profiles.unbind(name, key);
  print(TEXT.unbindDone(name, context.showKey(key), old), COLOR.ok);
}

export const bindCommands = Object.freeze([
  { parent: COMMAND.name, name: BIND_COMMAND.bind, usage: TEXT.bind.usage, desc: TEXT.bind.desc, keyArg: BIND_KEY_ARGUMENT, help: { about: TEXT.bind.about, examples: TEXT.bind.examples, see: TEXT.bind.see }, run: bind },
  { parent: COMMAND.name, name: BIND_COMMAND.unbind, usage: TEXT.unbind.usage, desc: TEXT.unbind.desc, keyArg: BIND_KEY_ARGUMENT, help: { see: TEXT.unbind.see }, run: unbind },
]);

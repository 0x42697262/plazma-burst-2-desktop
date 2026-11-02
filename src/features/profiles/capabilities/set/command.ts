import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { COMMAND } from '../../keys.ts';
import { SET_ARGUMENTS, UNSET_ARGUMENTS } from '../../constants.ts';
import { profileContext as context, profileStore as profiles } from '../../adapters/store.ts';
import { TEXT as SHARED_TEXT } from '../../text.ts';
import { isNone, requireGameKey, requireProfile } from '../../services/profile-view.ts';
import { SET_COMMAND } from './keys.ts';
import { SET_TEXT as TEXT } from './text.ts';

type Args = readonly string[];

function setValue(args: Args): void {
  const [name, word, raw] = args;
  if (args.length !== SET_ARGUMENTS || !name || raw === undefined) throw new Error(TEXT.setUsage);
  if (isNone(name)) throw new Error(SHARED_TEXT.noneIsReserved);
  const key = requireGameKey(word);
  const value = context.parseValue(key, raw);
  const isNew = !profiles.exists(name);
  profiles.set(name, key, value);
  print(TEXT.setDone(name, key, context.showValue(key, value), isNew), COLOR.ok);
}

function unsetValue(args: Args): void {
  if (args.length !== UNSET_ARGUMENTS) throw new Error(TEXT.unsetUsage);
  const name = requireProfile(args[0]);
  const key = requireGameKey(args[1]);
  if (!Object.hasOwn(profiles.get(name).values, key)) {
    print(TEXT.doesNotSet(name, key), COLOR.notice);
    return;
  }
  profiles.unset(name, key);
  print(TEXT.unsetDone(name, key), COLOR.ok);
}

export const setCommands = Object.freeze([
  { parent: COMMAND.name, name: SET_COMMAND.set, usage: TEXT.set.usage, desc: TEXT.set.desc, help: { examples: TEXT.set.examples, see: TEXT.set.see }, run: setValue },
  { parent: COMMAND.name, name: SET_COMMAND.unset, aliases: SET_COMMAND.unsetAliases, usage: TEXT.unset.usage, desc: TEXT.unset.desc, help: { see: TEXT.unset.see }, run: unsetValue },
]);

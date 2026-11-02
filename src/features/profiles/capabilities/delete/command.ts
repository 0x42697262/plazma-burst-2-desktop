import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { COMMAND } from '../../keys.ts';
import { profileStore as profiles } from '../../adapters/store.ts';
import { requireProfile } from '../../services/profile-view.ts';
import { DELETE_COMMAND } from './keys.ts';
import { DELETE_TEXT as TEXT } from './text.ts';

function remove(args: readonly string[]): void {
  if (args.length !== 1) throw new Error(TEXT.deleteUsage);
  const name = requireProfile(args[0]);
  print(TEXT.deleted(name, profiles.remove(name)), COLOR.ok);
}

export const deleteCommand = Object.freeze({ parent: COMMAND.name, name: DELETE_COMMAND.name, aliases: DELETE_COMMAND.aliases, usage: TEXT.usage, desc: TEXT.desc, help: { see: TEXT.see }, run: remove });

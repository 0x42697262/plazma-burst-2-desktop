import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { COMMAND } from '../../keys.ts';
import { profileStore as profiles } from '../../adapters/store.ts';
import { printProfile, requireProfile } from '../../services/profile-view.ts';
import { SHOW_COMMAND } from './keys.ts';
import { SHOW_TEXT as TEXT } from './text.ts';

function show(args: readonly string[]): void {
  const name = requireProfile(args[0]);
  print(TEXT.showTitle(name, profiles.mapsUsing(name)), COLOR.title);
  printProfile(profiles.get(name));
}

export const showCommand = Object.freeze({ parent: COMMAND.name, name: SHOW_COMMAND.name, usage: TEXT.usage, desc: TEXT.desc, help: { see: TEXT.see }, run: show });

import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { COMMAND } from '../../keys.ts';
import { profileContext as context } from '../../adapters/store.ts';
import { printProfile } from '../../services/profile-view.ts';
import { STATUS_TEXT as TEXT } from './text.ts';

function status(): void {
  const id = context.currentMap();
  if (!id) {
    print(TEXT.noMapLoaded, COLOR.notice);
    return;
  }
  const profile = context.active();
  if (!profile) {
    print(TEXT.mapWithout(id), COLOR.notice);
    return;
  }
  print(TEXT.mapUses(id, profile.name), COLOR.title);
  printProfile(profile);
}

export const statusCommand = Object.freeze({
  parent: COMMAND.name,
  ownRun: true,
  usage: TEXT.usage,
  desc: TEXT.description,
  help: { about: TEXT.about(context.gameKeyGroups()), args: TEXT.args, examples: TEXT.examples, notes: TEXT.notes, see: TEXT.see },
  run: status,
});

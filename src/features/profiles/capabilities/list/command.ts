import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { COMMAND } from '../../keys.ts';
import { NAME_WIDTH } from '../../constants.ts';
import { LIST_SEPARATOR } from '../../keys.ts';
import { profileContext as context, profileStore as profiles } from '../../adapters/store.ts';
import { summary } from '../../services/profile-view.ts';
import { LIST_COMMAND } from './keys.ts';
import { LIST_TEXT as TEXT } from './text.ts';

function list(): void {
  const names = profiles.names();
  if (!names.length) {
    print(TEXT.noProfiles, COLOR.notice);
    return;
  }
  const active = context.active();
  print(TEXT.profilesTitle(names.length), COLOR.title);
  for (const name of names) {
    const isHere = active?.name === name;
    print([[TEXT.listRow(name.padEnd(NAME_WIDTH), summary(profiles.get(name))), isHere ? COLOR.ok : undefined],
      [TEXT.listMaps(profiles.mapsUsing(name).join(LIST_SEPARATOR), isHere ? TEXT.thisMap : ''), COLOR.hint, true]]);
  }
}

export const listCommand = Object.freeze({ parent: COMMAND.name, name: LIST_COMMAND.name, aliases: LIST_COMMAND.aliases, usage: TEXT.usage, desc: TEXT.desc, help: { see: TEXT.see }, run: list });

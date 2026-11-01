import { print } from '../../../../desktop/dev/console/ui/log.js';
import { COLOR } from '../../../../desktop/dev/console/core/colors.js';
import { COMMAND } from '../keys.ts';
import { TEXT } from '../text.ts';
import { localMapIds } from '../adapters/wrapper-client.ts';

function listMaps(): void {
  localMapIds()
    .then((ids) => {
      if (!ids.length) {
        print(TEXT.listNone, COLOR.notice);
        return;
      }
      print(TEXT.listTitle, COLOR.title);
      for (const id of ids) print(TEXT.listRow(id));
    })
    .catch(() => print(TEXT.listFailed, COLOR.error));
}

export const mapsCommand = Object.freeze({
  name: COMMAND.name,
  usage: TEXT.usage,
  desc: TEXT.description,
  help: { about: TEXT.about, notes: TEXT.notes, see: TEXT.see },
  run: listMaps,
});

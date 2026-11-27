import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { SAVE_KEY } from '#kernel/game-save/keys.ts';
import { COMMAND, SUBCOMMAND } from '../../keys.ts';
import { gameSave } from '../../adapters/game.ts';
import { newDeviceId } from '../../domain/device-id.ts';
import { change } from './change.ts';
import { NEW_UID_TEXT } from './text.ts';

function newUid(args: readonly string[]): Promise<void> {
  if (args.length) throw new Error(NEW_UID_TEXT.usageError);
  const data = gameSave.saveData();
  const before = data[SAVE_KEY.uid];
  const uid = newDeviceId();
  return change(() => { data[SAVE_KEY.uid] = uid; }).then((isDone) => {
    if (!isDone) return;
    print(NEW_UID_TEXT.changed(uid, typeof before === 'string' ? before : null), COLOR.ok);
    print(NEW_UID_TEXT.next, COLOR.hint);
  });
}

export const newUidCommand = Object.freeze({
  parent: COMMAND.name,
  name: SUBCOMMAND.newUid,
  usage: NEW_UID_TEXT.usage,
  desc: NEW_UID_TEXT.desc,
  help: { about: NEW_UID_TEXT.about, examples: NEW_UID_TEXT.examples },
  run: (args: string[]) => newUid(args),
});

import { print } from '#console/kernel/ui/log.ts';
import { STATUS } from '#shared/contract/keys.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { decodeSaveText } from '#kernel/game-save/save-text.ts';
import { COMMAND, SUBCOMMAND } from '../../keys.ts';
import { SHARED_TEXT } from '../../text.ts';
import { gameSave } from '../../adapters/game.ts';
import { downloadSave } from '../../adapters/wrapper-client.ts';
import { diffSaves } from '../../domain/view.ts';
import { isNothingToLoad } from '../../domain/answer.ts';
import { TEXT } from './text.ts';

function diff(args: readonly string[]): Promise<void> | void {
  if (args.length) throw new Error(TEXT.usageError);
  const login = gameSave.loginParams().login;
  if (!login) {
    print(SHARED_TEXT.noLogin, COLOR.notice);
    return;
  }
  print(TEXT.asking(login), COLOR.hint);
  return downloadSave()
    .then(({ status, text }) => {
      if (status !== STATUS.ok) return print(SHARED_TEXT.siteRefused(status), COLOR.error);
      const online = isNothingToLoad(text) ? new Map<string, string>() : decodeSaveText(text);
      if (isNothingToLoad(text)) print(SHARED_TEXT.nothingOnline(login, text), COLOR.notice);
      const result = diffSaves(decodeSaveText(gameSave.saveText(true)), online);
      print(TEXT.summary(result.same, result.changed.length, result.onlyLocal.length, result.onlyOnline.length), COLOR.title);
      if (result.changed.length) print(TEXT.changedTitle, COLOR.title);
      for (const [name, local, other] of result.changed) print(TEXT.changedRow(name, local, other));
      if (result.onlyLocal.length) print(TEXT.onlyLocalTitle, COLOR.title);
      for (const [name, value] of result.onlyLocal) print(SHARED_TEXT.row(name, value));
      if (result.onlyOnline.length) print(TEXT.onlyOnlineTitle, COLOR.title);
      for (const [name, value] of result.onlyOnline) print(SHARED_TEXT.row(name, value));
      return undefined;
    })
    .catch((error: unknown) => { print((error as Error).message, COLOR.error); });
}

export const diffCommand = Object.freeze({
  parent: COMMAND.name,
  name: SUBCOMMAND.diff,
  usage: TEXT.usage,
  desc: TEXT.desc,
  help: { about: TEXT.about, examples: TEXT.examples },
  run: diff,
});

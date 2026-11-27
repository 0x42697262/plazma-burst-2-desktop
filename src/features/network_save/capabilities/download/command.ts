import { print } from '#console/kernel/ui/log.ts';
import { STATUS } from '#shared/contract/keys.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { decodeSaveText } from '#kernel/game-save/save-text.ts';
import { COMMAND, RAW_OPTION, SUBCOMMAND } from '../../keys.ts';
import { SHARED_TEXT } from '../../text.ts';
import { gameSave } from '../../adapters/game.ts';
import { downloadSave } from '../../adapters/wrapper-client.ts';
import { hiddenText, rowsOf } from '../../domain/view.ts';
import { isNothingToLoad } from '../../domain/answer.ts';
import { TEXT } from './text.ts';

function download(args: readonly string[]): Promise<void> | void {
  const isRaw = args.length === 1 && args[0] === RAW_OPTION;
  if (args.length && !isRaw) throw new Error(TEXT.usageError);
  const login = gameSave.loginParams().login;
  if (!login) {
    print(SHARED_TEXT.noLogin, COLOR.notice);
    return;
  }
  print(TEXT.asking(login), COLOR.hint);
  return downloadSave()
    .then(({ status, text }) => {
      if (status !== STATUS.ok) return print(SHARED_TEXT.siteRefused(status), COLOR.error);
      if (isNothingToLoad(text)) return print(SHARED_TEXT.nothingOnline(login, text), COLOR.notice);
      const values = decodeSaveText(text);
      print(TEXT.title(login, values.size, text.length), COLOR.title);
      if (isRaw) return print(hiddenText(text));
      for (const [name, value] of rowsOf(values)) print(SHARED_TEXT.row(name, value));
      return undefined;
    })
    .catch((error: unknown) => { print((error as Error).message, COLOR.error); });
}

export const downloadCommand = Object.freeze({
  parent: COMMAND.name,
  name: SUBCOMMAND.download,
  usage: TEXT.usage,
  desc: TEXT.desc,
  help: { about: TEXT.about, examples: TEXT.examples },
  run: download,
});

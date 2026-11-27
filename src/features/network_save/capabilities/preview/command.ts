import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { decodeSaveText } from '#kernel/game-save/save-text.ts';
import { COMMAND, RAW_OPTION, SUBCOMMAND } from '../../keys.ts';
import { SHARED_TEXT } from '../../text.ts';
import { gameSave } from '../../adapters/game.ts';
import { hiddenText, rowsOf } from '../../domain/view.ts';
import { TEXT } from './text.ts';

function preview(args: readonly string[]): void {
  const isRaw = args.length === 1 && args[0] === RAW_OPTION;
  if (args.length && !isRaw) throw new Error(TEXT.usageError);
  const login = gameSave.loginParams().login;
  if (!login) {
    print(SHARED_TEXT.noLogin, COLOR.notice);
    return;
  }
  const text = gameSave.saveText(true);
  const values = decodeSaveText(text);
  print(TEXT.title(login, values.size, text.length), COLOR.title);
  if (isRaw) {
    print(hiddenText(text));
    return;
  }
  for (const [name, value] of rowsOf(values)) print(SHARED_TEXT.row(name, value));
}

export const previewCommand = Object.freeze({
  parent: COMMAND.name,
  name: SUBCOMMAND.preview,
  usage: TEXT.usage,
  desc: TEXT.desc,
  help: { about: TEXT.about, examples: TEXT.examples },
  run: preview,
});

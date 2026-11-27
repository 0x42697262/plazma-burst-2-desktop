import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { agoText } from '#console/kernel/core/words.ts';
import { SAVE_SOURCE } from '#kernel/game-save/keys.ts';
import type { SaveSeen } from '#kernel/game-save/seen.ts';
import { COMMAND } from '../../keys.ts';
import { gameSave, lobbyLogin } from '../../adapters/game.ts';
import { seenSaves } from '../../adapters/wrapper-client.ts';
import { TEXT } from './text.ts';

const seenLine = (seen: SaveSeen, kind: string): readonly [number, string] => [seen.at, TEXT.seenRow(
  agoText(Date.now() - seen.at), seen.source === SAVE_SOURCE.game ? TEXT.byGame : TEXT.byConsole, kind, seen.login, seen.uid ? TEXT.withDevice : TEXT.withoutDevice,
)];

function status(args: readonly string[]): Promise<void> {
  if (args.length) throw new Error(TEXT.usageError);
  const page = gameSave.loginParams().login;
  print(page ? TEXT.account(page) : TEXT.noAccount, page ? COLOR.title : COLOR.notice);
  const lobby = lobbyLogin();
  if (lobby) print(TEXT.lobby(lobby));
  if (lobby && page && lobby.toLowerCase() !== page.toLowerCase()) print(TEXT.lobbyDiffers(lobby, page), COLOR.warn);
  print(TEXT.address(gameSave.saveUrl()));
  print(TEXT.local(Object.keys(gameSave.saveData()).length, gameSave.saveText(true).length));
  return seenSaves().then((seen) => {
    print(TEXT.seenTitle, COLOR.title);
    if (!seen) {
      print(TEXT.seenNoRecord, COLOR.muted);
      return;
    }
    const lines = [...seen.loads.map((entry) => seenLine(entry, TEXT.download)), ...seen.uploads.map((entry) => seenLine(entry, TEXT.upload))]
      .sort((first, second) => first[0] - second[0]);
    if (!lines.length) print(TEXT.seenNone, COLOR.muted);
    for (const [, line] of lines) print(line);
  });
}

export const statusCommand = Object.freeze({
  parent: COMMAND.name,
  ownRun: true,
  usage: TEXT.usage,
  desc: TEXT.desc,
  help: { about: TEXT.about, examples: TEXT.examples },
  run: status,
});

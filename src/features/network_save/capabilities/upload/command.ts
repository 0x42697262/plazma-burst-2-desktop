import { print } from '#console/kernel/ui/log.ts';
import { isCapabilityOn } from '#console/flags.ts';
import { CAPABILITY } from '#shared/features/keys.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { decodeSaveText } from '#kernel/game-save/save-text.ts';
import { SAVE_SOURCE } from '#kernel/game-save/keys.ts';
import type { SeenSaves } from '#kernel/game-save/seen.ts';
import { MIN_ERROR_STATUS, UPLOAD_SEEN_WAIT_MS } from '../../constants.ts';
import { COMMAND, DIRECT_OPTION, SUBCOMMAND, WORD_SEPARATOR, YES_OPTION } from '../../keys.ts';
import { SHARED_TEXT } from '../../text.ts';
import { gameSave, lobbyLogin } from '../../adapters/game.ts';
import { seenSaves, uploadSaveText } from '../../adapters/wrapper-client.ts';
import { TEXT } from './text.ts';

const wait = (ms: number): Promise<void> => new Promise((resolve) => { setTimeout(resolve, ms); });
const gameUploads = (seen: SeenSaves | null): number => (seen ? seen.uploads.filter((entry) => entry.source === SAVE_SOURCE.game).length : 0);

async function uploadNow(login: string): Promise<void> {
  print(TEXT.started(login), COLOR.hint);
  const before = await seenSaves();
  gameSave.saveUpload();
  await wait(UPLOAD_SEEN_WAIT_MS);
  const after = await seenSaves();
  if (!before || !after) print(TEXT.noRecord, COLOR.notice);
  else if (gameUploads(after) > gameUploads(before)) print(TEXT.uploaded(login), COLOR.ok);
  else print(TEXT.skipped, COLOR.warn);
}

async function uploadDirect(login: string): Promise<void> {
  const text = gameSave.saveText(true);
  const { status } = await uploadSaveText(text);
  print(TEXT.sentDirect(login, decodeSaveText(text).size, status), status >= MIN_ERROR_STATUS ? COLOR.error : COLOR.ok);
}

function upload(args: readonly string[]): Promise<void> | void {
  const options = new Set(args);
  const isKnown = args.every((arg) => arg === YES_OPTION || arg === DIRECT_OPTION) && options.size === args.length;
  if (!isKnown) throw new Error(TEXT.usageError);
  const isYes = options.has(YES_OPTION);
  const isDirect = options.has(DIRECT_OPTION);
  if (isDirect && !isCapabilityOn(CAPABILITY.networkSave.direct)) throw new Error(TEXT.directOff);
  const login = gameSave.loginParams().login;
  if (!login) {
    print(SHARED_TEXT.noLogin, COLOR.notice);
    return;
  }
  const lobby = lobbyLogin();
  if (lobby && lobby.toLowerCase() !== login.toLowerCase()) print(TEXT.lobbyDiffers(lobby, login), COLOR.warn);
  if (!isYes) {
    print(TEXT.wouldUpload(login, decodeSaveText(gameSave.saveText(true)).size, isDirect ? TEXT.byApp : TEXT.byGame), COLOR.title);
    print(TEXT.howToGo([COMMAND.name, SUBCOMMAND.upload, ...(isDirect ? [DIRECT_OPTION] : [])].join(WORD_SEPARATOR)), COLOR.hint);
    return;
  }
  return (isDirect ? uploadDirect(login) : uploadNow(login)).catch((error: unknown) => { print((error as Error).message, COLOR.error); });
}

export const uploadCommand = Object.freeze({
  parent: COMMAND.name,
  name: SUBCOMMAND.upload,
  usage: TEXT.usage,
  desc: TEXT.desc,
  help: { about: TEXT.about, examples: TEXT.examples },
  run: upload,
});

import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { CLIENT_TITLE } from '#console/kernel/game/names.ts';
import { SAVE_STORAGE_KEY } from '#kernel/game-save/keys.ts';
import { deviceOfSave } from '#kernel/game-save/save-text.ts';
import { COMMAND, DEVICE_COMMAND, ID_SHAPE, ORIGIN } from '../../keys.ts';
import { idShape, originOf } from '../../domain/device.ts';
import { durationText } from '../../domain/reply.ts';
import { seenSaves } from '../../adapters/wrapper-client.ts';
import { TEXT } from './text.ts';

const agoOf = (at: number): string => durationText(Date.now() - at);

function originLines(uid: string | null, seen: Awaited<ReturnType<typeof seenSaves>>): string[] {
  if (!seen) return [TEXT.noRecord];
  const origin = originOf(uid, seen.loads, seen.uploads);
  const lines: string[] = [];
  if (origin.kind === ORIGIN.notSeen || !origin.load) lines.push(TEXT.notSeen);
  else if (origin.kind === ORIGIN.fromNetworkSave) lines.push(TEXT.fromNetworkSave(agoOf(origin.load.at), origin.load.login));
  else if (origin.kind === ORIGIN.keptLocal) lines.push(TEXT.keptLocal(agoOf(origin.load.at), origin.load.login));
  else lines.push(TEXT.differs(agoOf(origin.load.at), origin.load.login, origin.load.uid ?? TEXT.noValue));
  const upload = origin.upload;
  if (upload) lines.push(upload.uid === uid ? TEXT.uploaded(agoOf(upload.at), upload.login) : TEXT.uploadedOther(agoOf(upload.at), upload.login, upload.uid ?? TEXT.noValue));
  return lines;
}

function device(args: readonly string[]): Promise<void> {
  if (args.length) throw new Error(TEXT.usageError);
  return show();
}

async function show(): Promise<void> {
  const values = deviceOfSave(localStorage.getItem(SAVE_STORAGE_KEY));
  const seen = await seenSaves();
  if (values.uid === null) print(TEXT.noId, COLOR.notice);
  else {
    print(TEXT.title(values.uid), COLOR.title);
    print(TEXT.sent);
    print(idShape(values.uid) === ID_SHAPE.game ? TEXT.shapeGame : TEXT.shapeOther, idShape(values.uid) === ID_SHAPE.game ? undefined : COLOR.warn);
  }
  print(values.firstLogin === null ? TEXT.noFirstLogin : TEXT.firstLogin(values.firstLogin, values.hasProof));
  print(TEXT.originTitle, COLOR.title);
  for (const line of originLines(values.uid, seen)) print(line);
  print(TEXT.where(CLIENT_TITLE), COLOR.hint);
}

export const deviceCommand = Object.freeze({
  parent: COMMAND.name,
  name: DEVICE_COMMAND.name,
  aliases: DEVICE_COMMAND.aliases,
  usage: TEXT.usage,
  desc: TEXT.desc,
  help: { about: TEXT.about, examples: TEXT.examples },
  run: device,
});

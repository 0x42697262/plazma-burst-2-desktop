import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { isCapabilityOn } from '#console/flags.ts';
import { CAPABILITY } from '#shared/features/keys.ts';
import { CHANNEL, COMMAND, OTHER_CLIENTS } from '../../keys.ts';
import { WIRE_TEXT as TEXT } from '../../text.ts';
import { parseArgs } from '../../domain/parse.ts';
import { resolve } from '../../services/resolve.ts';
import { dryLines, sendResolved } from '../../services/send.ts';
import { SEND_TEXT } from './text.ts';

const replyText = (reply: unknown): string => {
  try { return JSON.stringify(Array.from(reply as Iterable<unknown>)); } catch { return String(reply); }
};

function wireSend(args: string[]): void {
  const parsed = parseArgs(args);
  const { message, flags } = parsed;
  if (!message.sendable) throw new Error(TEXT.receiveOnly(message.name, message.note ?? ''));
  const isMatch = message.channel === CHANNEL.match;
  const capability = isMatch ? CAPABILITY.wire.match : CAPABILITY.wire.lobby;
  if (!isCapabilityOn(capability)) throw new Error(TEXT.turnedOff(message.name, isMatch ? TEXT.matchMessages : TEXT.lobbyMessages));
  if (message.force && !flags.force) throw new Error(TEXT.needsForce(message.name));
  const resolution = resolve(parsed);
  for (const line of resolution.report) print(line, COLOR.muted);
  if (flags.dry) { for (const line of dryLines(resolution)) print(line, COLOR.muted); return; }
  sendResolved(resolution, (reply) => { print(TEXT.replyGot(message.name, replyText(reply)), COLOR.notice); });
  print(TEXT.sent(message.name), COLOR.ok);
  if (message.direction.includes(OTHER_CLIENTS)) print(TEXT.otherClientsNote, COLOR.muted);
}

export const sendCommand = Object.freeze({
  parent: COMMAND.name, ownRun: true, capability: CAPABILITY.wire.send,
  usage: SEND_TEXT.usage, desc: SEND_TEXT.desc,
  help: { about: SEND_TEXT.about, args: SEND_TEXT.args, examples: SEND_TEXT.examples, see: SEND_TEXT.see },
  run: wireSend,
});

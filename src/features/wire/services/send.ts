import { game } from '#console/kernel/game/bindings.ts';
import { stringOf } from '#kernel/text/text-of.ts';
import { CHANNEL, TYPE_PREFIX } from '../keys.ts';
import { WIRE_TEXT as TEXT } from '../text.ts';
import type { OutPart, Resolution } from './resolve.ts';

type SendBindings = Readonly<{
  replyTo(): unknown;
  sendLobby(typeName: string, parts: readonly unknown[], reply?: unknown): void;
  sendEvent(typeName: string, parts: readonly unknown[]): void;
  encodeNumber(value: number): unknown;
}>;

const bind = game as unknown as SendBindings;

const toArg = (part: OutPart): unknown => {
  if (part.reply) return bind.replyTo();
  if (part.encode) return bind.encodeNumber(part.number ?? 0);
  return part.text ?? '';
};

export function dryLines(resolution: Resolution): string[] {
  const lines: string[] = [TEXT.dryHeader];
  for (const part of resolution.parts) {
    if (part.reply) { lines.push(TEXT.dryColumns(part.fieldName, TEXT.replyTyped, TEXT.replyWire, '')); continue; }
    if (part.encode) {
      lines.push(TEXT.dryColumns(part.fieldName, part.typed, stringOf(part.number ?? 0), part.scale === undefined ? '' : TEXT.scaleNote(part.scale)));
      continue;
    }
    lines.push(TEXT.dryColumns(part.fieldName, part.typed, JSON.stringify(part.text ?? ''), ''));
  }
  return lines;
}

export function sendResolved(resolution: Resolution, onReply?: (reply: unknown) => void): void {
  const { message, parts } = resolution;
  const args = parts.map(toArg);
  const typeName = TYPE_PREFIX + message.name;
  if (message.channel === CHANNEL.lobby && message.reply) bind.sendLobby(typeName, args, onReply);
  else bind.sendEvent(typeName, args);
}

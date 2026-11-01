import { decodeNumber, showPart, splitParts, unescField, FIELD } from '#console/kernel/net/codec.ts';
import { DECIMAL_RADIX, FIRST_RELIABLE_FIELD, HIT_PLAYER_SENT_PARTS, RELIABLE_FIELD_STRIDE } from '../constants.ts';
import { MESSAGE_TYPE, TYPE_PREFIX, UNKNOWN_MARK, UNKNOWN_TYPE_PREFIX } from '../keys.ts';
import { LINE_TEXT } from '../text.ts';
import { redactParts } from './redaction.ts';

export type TypeNameOf = (type: number) => string | null;
export type ReliableEntry = { uid: number; data: string; size: number };
export type Packet = { ack: number; state: string; stateSize: number; rel: ReliableEntry[] };
export type DescribedMessage = { name: string; parts: string[]; text: string };

type NumberRule = (index: number, partCount: number) => boolean;
const always: NumberRule = () => true;

const NUMBER_PARTS: Readonly<Record<string, NumberRule>> = Object.freeze({
  [MESSAGE_TYPE.response]: (index) => index === 1,
  [MESSAGE_TYPE.respawn]: always,
  [MESSAGE_TYPE.ressurect]: always,
  [MESSAGE_TYPE.healPlayer]: always,
  [MESSAGE_TYPE.hitPlayer]: (index, partCount) => partCount <= HIT_PLAYER_SENT_PARTS || index < partCount - 1,
});
const never: NumberRule = () => false;

export function parsePacket(text: string): Packet {
  const raw = text.split(FIELD);
  const fields = raw.map(unescField);
  const rel: ReliableEntry[] = [];
  for (let index = FIRST_RELIABLE_FIELD; index + 1 < fields.length; index += RELIABLE_FIELD_STRIDE) {
    rel.push({ uid: parseInt(fields[index] ?? '', DECIMAL_RADIX), data: fields[index + 1] ?? '', size: (raw[index + 1] ?? '').length });
  }
  return { ack: parseInt(fields[0] ?? '', DECIMAL_RADIX), state: fields[1] || '', stateSize: (raw[1] || '').length, rel };
}

function messageName(type: number | null, typeName: TypeNameOf): string {
  const fullName = type !== null ? typeName(type) : null;
  if (fullName) return fullName.replace(TYPE_PREFIX, '');
  return UNKNOWN_TYPE_PREFIX + (type !== null ? String(type) : UNKNOWN_MARK);
}

export function describeMessage(data: string, digits: string, typeName: TypeNameOf, whole = false): DescribedMessage {
  const parts = splitParts(data);
  const type = decodeNumber(parts[0], digits);
  const name = messageName(type, typeName);
  const isNumber = NUMBER_PARTS[name] ?? never;
  const shownParts = redactParts(name, parts);
  const args = shownParts.slice(1).map((part, index) => showPart(part, digits, isNumber(index + 1, parts.length), whole)).join(LINE_TEXT.argumentSeparator);
  return { name, parts, text: LINE_TEXT.message(name, args) };
}

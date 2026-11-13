import { decodeNumber, showPart, splitParts } from '#console/kernel/net/codec.ts';
import { HIT_PLAYER_SENT_PARTS } from '../constants.ts';
import { MESSAGE_TYPE, TYPE_PREFIX, UNKNOWN_MARK, UNKNOWN_TYPE_PREFIX } from '../keys.ts';
import { LINE_TEXT } from '../text.ts';
import { redactParts } from './redaction.ts';

export type TypeNameOf = (type: number) => string | null;
export { parsePacket, type Packet, type ReliableEntry } from '#console/kernel/net/codec.ts';
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

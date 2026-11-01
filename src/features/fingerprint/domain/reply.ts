import {
  BASE36_HASH, CODE_POINT_PAD, CODE_POINT_PREFIX, CODE_POINT_SEPARATOR, CODE_POINT_WIDTH, DOUBLE_QUOTE, ESCAPED_DOUBLE_QUOTE, HEX_RADIX,
  IPV4, IPV6, JOIN_CALL, JSON_OBJECT_START, ORIGIN, UNKNOWN_LABEL, USER_AGENT_KEY, asJsonString, quoted,
} from '../keys.ts';
import { LABEL } from '../text.ts';

export type JsonObject = Record<string, unknown>;

export function jsonObject(text: string): JsonObject | null {
  if (!JSON_OBJECT_START.test(text)) return null;
  try {
    const value: unknown = JSON.parse(text);
    return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : null;
  } catch {
    return null;
  }
}

export function separatorOf(code: string): string | null {
  let separator: string | null = null;
  for (const match of code.matchAll(JOIN_CALL)) {
    const written = match[2] ?? '';
    try {
      separator = JSON.parse(asJsonString(written.replace(DOUBLE_QUOTE, ESCAPED_DOUBLE_QUOTE))) as string;
    } catch {
      separator = written;
    }
  }
  return separator;
}

export const codePointOf = (text: string): string => [...text]
  .map((character) => CODE_POINT_PREFIX + (character.codePointAt(0) ?? 0).toString(HEX_RADIX).toUpperCase().padStart(CODE_POINT_WIDTH, CODE_POINT_PAD))
  .join(CODE_POINT_SEPARATOR);

export function labelOf(text: string, tag: string, code: string, timeZone: string | null): string {
  const object = jsonObject(text);
  if (object) {
    const count = Object.keys(object).length;
    return USER_AGENT_KEY in object ? LABEL.full(count) : LABEL.hardwareOnly(count);
  }
  if (text === tag) return LABEL.buildTag;
  const isWrittenIntoSource = !!text && quoted(text).some((form) => code.includes(form));
  if (IPV4.test(text) || IPV6.test(text)) return isWrittenIntoSource ? LABEL.ipWritten : LABEL.ip;
  if (isWrittenIntoSource) return LABEL.token;
  if (ORIGIN.test(text)) return LABEL.origin;
  if (text === timeZone) return LABEL.timeZone;
  if (BASE36_HASH.test(text)) return LABEL.hash;
  return UNKNOWN_LABEL;
}

export function replyOf(value: unknown): string[] | null {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return [String(value)];
  if (Array.isArray(value)) return value.map((item) => String(item));
  return null;
}

export function splitReply(parts: readonly string[], code: string): { values: readonly string[]; separator: string | null } {
  const separator = parts.length === 1 ? separatorOf(code) : null;
  const [only] = parts;
  const isJoined = separator !== null && only !== undefined && only.includes(separator);
  return isJoined ? { values: only.split(separator), separator } : { values: parts, separator: null };
}

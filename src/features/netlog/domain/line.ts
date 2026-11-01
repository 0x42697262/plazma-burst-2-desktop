import { clockOf } from '#kernel/log/logger.ts';
import { CONNECTION_COLUMN_WIDTH, DIRECTION_COLUMN_WIDTH, KILOBYTE, KIND_COLUMN_WIDTH, SIZE_DECIMALS, SIZE_IN_KILOBYTES_FROM } from '../constants.ts';
import { LOG_LINE, NO_CONNECTION, type Direction, type LineKind } from '../keys.ts';
import { LINE_TEXT } from '../text.ts';

export type ParsedLine = { time: string; conn: string; dir: string; kind: string; text: string };
export type LineConnection = { id: number; kind: string } | null;

export const clockText = (milliseconds: number): string => clockOf(new Date(milliseconds));

export const sizeText = (length: number): string => (length < SIZE_IN_KILOBYTES_FROM ? LINE_TEXT.chars(length) : LINE_TEXT.kiloChars((length / KILOBYTE).toFixed(SIZE_DECIMALS)));

export function formatLine(time: number, connection: LineConnection, direction: Direction, kind: LineKind, text: string): string {
  const connectionText = connection ? LINE_TEXT.connection(connection.id, connection.kind) : NO_CONNECTION;
  return LINE_TEXT.line(clockText(time), connectionText.padEnd(CONNECTION_COLUMN_WIDTH), direction.padEnd(DIRECTION_COLUMN_WIDTH), kind.padEnd(KIND_COLUMN_WIDTH), text);
}

export function parseLine(line: string): ParsedLine | null {
  const match = LOG_LINE.exec(line);
  if (!match) return null;
  const [, time = '', conn = '', dir = '', kind = '', text = ''] = match;
  return { time, conn, dir, kind, text };
}

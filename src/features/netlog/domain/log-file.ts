import { INSTANCE_NAME_MAX, LINE_CHARS_MAX, MONTH_OFFSET, STAMP_FIELD_WIDTH } from '../constants.ts';
import {
  INSTANCE, LINE_BREAK_REPLACEMENT, STAMP_PAD, LINE_BREAKS, LOG_FILE_HEADER_MARK, RUN_INSTANCE, RUN_NAME, SAFE_REPLACEMENT,
  UNSAFE_INSTANCE_CHARACTER,
} from '../keys.ts';
import { FILE_TEXT } from '../text.ts';

const pad = (value: number): string => String(value).padStart(STAMP_FIELD_WIDTH, STAMP_PAD);

export const stampOf = (moment: Date): string => FILE_TEXT.stamp(
  moment.getFullYear(), pad(moment.getMonth() + MONTH_OFFSET), pad(moment.getDate()), pad(moment.getHours()), pad(moment.getMinutes()), pad(moment.getSeconds()),
);

export const safeInstanceName = (instance: string | null | undefined): string => (instance || INSTANCE.local).replace(UNSAFE_INSTANCE_CHARACTER, SAFE_REPLACEMENT).slice(0, INSTANCE_NAME_MAX) || INSTANCE.local;

export const isRunName = (name: string | null | undefined): boolean => RUN_NAME.test(name || '');

export const instanceOfRun = (name: string): string => RUN_INSTANCE.exec(name)?.[1] ?? name;

export const cleanLine = (line: unknown): string => String(line).replace(LINE_BREAKS, LINE_BREAK_REPLACEMENT).slice(0, LINE_CHARS_MAX);

export const isEventLine = (line: string): boolean => line !== '' && !line.startsWith(LOG_FILE_HEADER_MARK);

export const fileHeader = (startedText: string, instance: string, version: string, pid: number): string[] => [
  ...FILE_TEXT.header,
  FILE_TEXT.runStarted(startedText, instance, version, pid),
  '',
];

export type InstanceContext = { remote?: boolean; server?: boolean; name?: string };

export function instanceFor(context: InstanceContext, isSadburst: boolean): string {
  if (context.remote) return INSTANCE.testerPrefix + (context.name ?? '');
  if (context.server) return INSTANCE.server;
  return isSadburst ? INSTANCE.sadburst : INSTANCE.local;
}

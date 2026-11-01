import { PING_NONE } from '../constants.ts';
import { LOSS_ORDER } from '../keys.ts';
import { CLOSE_REASONS, LINE_TEXT } from '../text.ts';

export type Counts = {
  pkOut: number; bytesOut: number; pkIn: number; bytesIn: number; relOut: number; relIn: number; stateOut: number; stateIn: number;
  repeatsOut: number; repeatsIn: number; acked: number; ackMs: number; slow: number; stalled: number; dropped: number; gaps: number; late: number;
};

export const newCounts = (): Counts => ({
  pkOut: 0, bytesOut: 0, pkIn: 0, bytesIn: 0, relOut: 0, relIn: 0, stateOut: 0, stateIn: 0,
  repeatsOut: 0, repeatsIn: 0, acked: 0, ackMs: 0, slow: 0, stalled: 0, dropped: 0, gaps: 0, late: 0,
});

export function lossText(counts: Counts): string {
  const items = LOSS_ORDER
    .filter((key) => counts[key])
    .map((key) => {
      const [word, pluralSuffix] = LINE_TEXT.lossWords[key];
      return LINE_TEXT.lossItem(counts[key], word, pluralSuffix);
    });
  return items.length ? items.join(LINE_TEXT.lossSeparator) : LINE_TEXT.lossNone;
}

export const repeatText = (counts: Counts): string => LINE_TEXT.repeated(counts.repeatsOut, counts.repeatsIn);
export const ackText = (counts: Counts): string => (counts.acked ? LINE_TEXT.acksIn(Math.round(counts.ackMs / counts.acked)) : '');

export function reasonText(reason: string | null | undefined): string {
  if (!reason) return LINE_TEXT.noReason;
  const text = reason;
  const known = Object.entries(CLOSE_REASONS).find(([start]) => text.startsWith(start));
  return known ? LINE_TEXT.reasonWithMeaning(text, known[1]) : text;
}

export function pingText(ping: unknown): string {
  if (typeof ping !== 'number') return LINE_TEXT.unknown;
  return ping >= PING_NONE ? LINE_TEXT.pingNoneYet : LINE_TEXT.pingMs(ping);
}

import { LOG_MAX } from '../core/constants.ts';
import { redact } from '../core/mode.ts';
import { LINE_ELEMENT, LOG_TAG, SEGMENT_ELEMENT, SMALL_TEXT_SIZE } from './keys.ts';
import { el } from './dom.ts';
import { TEXT } from './text.ts';
import { stringOf } from '#kernel/text/text-of.ts';

export const TAG = LOG_TAG;

export type Segment = readonly [text: unknown, color?: string, small?: boolean];
type Pane = { append(node: Node): void; childNodes: { length: number }; firstChild: { remove(): void } | null; scrollTop: number; scrollHeight: number; textContent: string | null };

let logElement: Pane | null = null;

export const attachLog = (element: Pane | null): void => { logElement = element; };
export const clearLog = (): void => {
  if (logElement) logElement.textContent = '';
};

export function print(text: unknown, color?: string): void {
  const segments: readonly Segment[] = Array.isArray(text) ? text as Segment[] : [[text, color]];
  console.log(TEXT.terminalLine(TAG, segments.map((segment) => stringOf(segment[0])).join('')));
  if (!logElement) return;
  const line = el(LINE_ELEMENT, color ? { color } : {});
  for (const [segmentText, segmentColor, small] of segments) {
    const style: Record<string, string> = {};
    if (segmentColor) style.color = segmentColor;
    if (small) style.fontSize = SMALL_TEXT_SIZE;
    line.append(el(SEGMENT_ELEMENT, style, redact(segmentText)));
  }
  logElement.append(line);
  while (logElement.childNodes.length > LOG_MAX) logElement.firstChild?.remove();
  logElement.scrollTop = logElement.scrollHeight;
}

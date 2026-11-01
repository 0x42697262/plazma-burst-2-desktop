import {
  BOTH_SIDES, CHAR_WIDTH, COLLAPSED_LINES, FONT_SIZE, GROUP_RADIUS, HOVER_RADIUS, LABEL_GAP, LABEL_OFFSET, LABEL_SHIFTS, LINE_HEIGHT, MOVED_LABEL_DISTANCE, OPEN_LINES, PAD,
} from './constants.ts';
import { LABEL_STYLE } from './keys.ts';
import { TEXT } from './text.ts';

export { FONT_SIZE, LINE_HEIGHT, PAD };

type Point = { x: number; y: number };
type Box = Point & { w: number; h: number };
export type LabelItem = Point & { text: string };
type Group = { at: Point; texts: string[]; open: boolean };
export type Label = Box & { lines: string[]; at: Point; open: boolean };
type Bounds = { w: number; h: number };

const distance = (first: Point, second: Point): number => Math.hypot(first.x - second.x, first.y - second.y);

function groups(items: readonly LabelItem[]): Omit<Group, 'open'>[] {
  const grouped: Omit<Group, 'open'>[] = [];
  for (const item of items) {
    const group = grouped.find((candidate) => distance(candidate.at, item) <= GROUP_RADIUS);
    if (!group) grouped.push({ at: { x: item.x, y: item.y }, texts: [item.text] });
    else if (!group.texts.includes(item.text)) group.texts.push(item.text);
  }
  return grouped;
}

function linesOf(texts: string[], open: boolean): string[] {
  const max = open ? OPEN_LINES : COLLAPSED_LINES;
  if (texts.length <= max) return texts;
  return [...texts.slice(0, max - 1), TEXT.moreLines(texts.length - (max - 1))];
}

const overlaps = (first: Box, second: Box): boolean => first.x < second.x + second.w + LABEL_GAP && second.x < first.x + first.w + LABEL_GAP
  && first.y < second.y + second.h + LABEL_GAP && second.y < first.y + first.h + LABEL_GAP;
const inside = (box: Box, bounds: Bounds): boolean => box.x >= 0 && box.y >= 0 && box.x + box.w <= bounds.w && box.y + box.h <= bounds.h;

function spots(width: number, height: number): [number, number][] {
  const right = LABEL_OFFSET;
  const left = -LABEL_OFFSET - width;
  const above = -LABEL_OFFSET - height;
  const below = LABEL_OFFSET;
  const tried: [number, number][] = [[right, above], [right, below], [left, above], [left, below]];
  for (let shift = 1; shift <= LABEL_SHIFTS; shift++) {
    const step = shift * (height + LABEL_GAP);
    tried.push([right, above - step], [right, below + step], [left, above - step], [left, below + step]);
  }
  return tried;
}

export function layoutLabels(items: readonly LabelItem[], { cursor = null, bounds }: { cursor?: Point | null; bounds: Bounds }): { labels: Label[]; hidden: number } {
  const nearness = (group: Omit<Group, 'open'>): number => (cursor ? distance(group.at, cursor) : 0);
  const withOpen: Group[] = groups(items).map((group) => ({ ...group, open: !!cursor && distance(group.at, cursor) <= HOVER_RADIUS }));
  withOpen.sort((first, second) => Number(second.open) - Number(first.open) || nearness(first) - nearness(second) || second.texts.length - first.texts.length);
  const placed: Label[] = [];
  let hidden = 0;
  for (const group of withOpen) {
    const lines = linesOf(group.texts, group.open);
    const width = Math.max(...lines.map((line) => line.length)) * CHAR_WIDTH + BOTH_SIDES * PAD;
    const height = lines.length * LINE_HEIGHT + BOTH_SIDES * PAD;
    const boxes: Box[] = spots(width, height).map(([shiftX, shiftY]) => ({ x: group.at.x + shiftX, y: group.at.y + shiftY, w: width, h: height }));
    const isFree = (box: Box): boolean => !placed.some((label) => overlaps(box, label));
    const free = boxes.find((box) => inside(box, bounds) && isFree(box)) ?? boxes.find(isFree) ?? (group.open ? boxes[0] : undefined);
    if (free) placed.push({ ...free, lines, at: group.at, open: group.open });
    else hidden++;
  }
  return { labels: placed.sort((first, second) => Number(first.open) - Number(second.open)), hidden };
}

export function drawLabels(context: CanvasRenderingContext2D, items: readonly LabelItem[], cursor: Point | null, bounds: Bounds): { shown: number; hidden: number } {
  const { labels, hidden } = layoutLabels(items, { cursor, bounds });
  context.font = LABEL_STYLE.font(FONT_SIZE);
  context.textBaseline = LABEL_STYLE.baseline;
  for (const label of labels) {
    const isMoved = label.x > label.at.x + MOVED_LABEL_DISTANCE || label.x + label.w < label.at.x - MOVED_LABEL_DISTANCE
      || label.y > label.at.y + MOVED_LABEL_DISTANCE || label.y + label.h < label.at.y - MOVED_LABEL_DISTANCE;
    if (isMoved) {
      context.strokeStyle = LABEL_STYLE.leader;
      context.beginPath();
      context.moveTo(label.at.x, label.at.y);
      context.lineTo(Math.min(Math.max(label.at.x, label.x), label.x + label.w), Math.min(Math.max(label.at.y, label.y), label.y + label.h));
      context.stroke();
    }
    context.fillStyle = label.open ? LABEL_STYLE.openPlate : LABEL_STYLE.plate;
    context.fillRect(label.x, label.y, label.w, label.h);
    context.fillStyle = LABEL_STYLE.color;
    label.lines.forEach((text, line) => { context.fillText(text, label.x + PAD, label.y + PAD + line * LINE_HEIGHT); });
  }
  return { shown: labels.length, hidden };
}

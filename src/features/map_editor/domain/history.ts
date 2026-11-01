import { HISTORY_MAX_ENTRIES } from './constants.ts';
import { CHANGE } from './keys.ts';
import type { AttrValues, MapElement } from './doc.ts';

export type AttrsChange = { kind: typeof CHANGE.attrs; element: MapElement; before: AttrValues; after: AttrValues };
export type PlaceChange = { kind: typeof CHANGE.insert | typeof CHANGE.remove; element: MapElement; at: number };
export type Change = AttrsChange | PlaceChange;
export type Entry = Change[];

const undoList: Entry[] = [];
const redoList: Entry[] = [];
let open: Entry | null = null;

export function beginAction(): void {
  if (!open) open = [];
}

function push(entry: Entry): void {
  undoList.push(entry);
  if (undoList.length > HISTORY_MAX_ENTRIES) undoList.shift();
  redoList.length = 0;
}

export function endAction(): void {
  const entry = open;
  open = null;
  if (entry && entry.length) push(entry);
}

export function record(change: Change): void {
  if (!open) {
    push([change]);
    return;
  }
  const last = open[open.length - 1];
  if (change.kind === CHANGE.attrs && last && last.kind === CHANGE.attrs && last.element === change.element) {
    for (const [attr, value] of Object.entries(change.before)) if (!(attr in last.before)) last.before[attr] = value;
    Object.assign(last.after, change.after);
    return;
  }
  open.push(change);
}

export const takeUndo = (): Entry | null => {
  const entry = undoList.pop();
  if (entry) redoList.push(entry);
  return entry || null;
};
export const takeRedo = (): Entry | null => {
  const entry = redoList.pop();
  if (entry) undoList.push(entry);
  return entry || null;
};
export const canUndo = (): boolean => undoList.length > 0;
export const canRedo = (): boolean => redoList.length > 0;
export function clearHistory(): void {
  undoList.length = 0;
  redoList.length = 0;
  open = null;
}

import { ROUTE } from '#shared/contract/routes.ts';
import { stringOf } from '#kernel/text/text-of.ts';
import { kindOf, nameOf, SHAPE, DEFAULTS, NOT_PLACED, newUid, tidy, type Kind } from '../domain/kinds.ts';
import { MapDoc, newElement, type AttrValues, type Attrs, type MapElement } from '../domain/doc.ts';
import { beginAction, endAction, record, takeUndo, takeRedo, clearHistory, type Entry } from '../domain/history.ts';
import type { LoadPlan } from '../domain/merge.ts';
import { CHANGE } from '../domain/keys.ts';
import { applyLive } from './apply.ts';
import { addLive, removeLive, restoreLive } from './rebuild.ts';
import { forgetGuns } from './guns.ts';
import { forgetLamps } from './lamps.ts';
import { editorDoc, notify, isPending, markPending, onChange, select, selected, resetDocument, docInLevel, NOTICE } from './session.ts';
import { DUPLICATE_OFFSET, NEW_RECT } from './constants.ts';
import {
  ATTRIBUTE_NAME, DOUBLE_QUOTE, NUMBER_ATTRS, SAVE_METHOD, SAVE_NAME, liveKey, saveUrl,
} from './keys.ts';
import { SERVICES_TEXT as TEXT } from './text.ts';

type Place = { x: number; y: number; w?: number; h?: number };
type Quiet = { recorded?: boolean };
export type ChangeResult = { changed: boolean; live: boolean; why?: string };
export type EditSummary = { changed: number; added: number; deleted: number; inLevel: boolean };
export type NotLive = { name: string; why: string };

let lastWhy = '';
export const notLiveReason = (): string => lastWhy;

const takenOut = new Set<MapElement>();

const currentDoc = (): MapDoc => editorDoc() as MapDoc;

function checkValue(attr: string, value: string): void {
  if (!ATTRIBUTE_NAME.test(attr)) throw new Error(TEXT.notAttributeName(attr));
  if (value.includes(DOUBLE_QUOTE)) throw new Error(TEXT.noDoubleQuote);
  if (NUMBER_ATTRS.has(attr) && !Number.isFinite(Number(value))) throw new Error(TEXT.mustBeNumber(attr));
}

function change(item: MapElement, values: Readonly<Record<string, unknown>>, { recorded = true }: Quiet = {}): ChangeResult {
  const doc = currentDoc();
  for (const [attr, raw] of Object.entries(values)) if (raw !== undefined) checkValue(attr, stringOf(raw));
  let live = true;
  let why = '';
  const before: AttrValues = {};
  const after: AttrValues = {};
  for (const [attr, raw] of Object.entries(values)) {
    const old = item.attrs[attr];
    if (!doc.set(item, attr, raw === undefined ? undefined : stringOf(raw))) continue;
    before[attr] = old;
    after[attr] = item.attrs[attr];
    const applied = applyLive(item, attr);
    if (!applied.live) {
      live = false;
      why ||= applied.why;
      markPending(item);
    }
  }
  if (!Object.keys(after).length && !Object.keys(before).length) return { changed: false, live: true };
  if (recorded) record({ kind: CHANGE.attrs, element: item, before, after });
  lastWhy = live ? '' : why;
  notify(NOTICE.edit);
  return { changed: true, live, why };
}

function addToLevel(item: MapElement): string {
  const { problem = '', ...live } = addLive(item);
  item.live = live;
  return problem;
}

function insert(item: MapElement, at?: number, { recorded = true }: Quiet = {}): void {
  const doc = currentDoc();
  const where = doc.insert(item, at);
  try {
    if (item.live) {
      restoreLive(item);
      takenOut.delete(item);
      lastWhy = '';
    } else lastWhy = addToLevel(item);
  } catch (error) {
    markPending(item);
    lastWhy = (error as Error).message;
  }
  if (recorded) record({ kind: CHANGE.insert, element: item, at: where });
  notify(NOTICE.edit);
}

function remove(item: MapElement, { recorded = true }: Quiet = {}): void {
  const doc = currentDoc();
  const at = doc.remove(item);
  if (at < 0) return;
  if (item.live) {
    try {
      removeLive(item);
      takenOut.add(item);
      lastWhy = '';
    } catch (error) {
      markPending(item);
      lastWhy = (error as Error).message;
    }
  }
  if (selected() === item) select(null);
  if (recorded) record({ kind: CHANGE.remove, element: item, at });
  notify(NOTICE.edit);
}

export const setAttr = (item: MapElement, attr: string, value: unknown): ChangeResult => change(item, { [attr]: value });
export const setAttrs = (item: MapElement, values: Readonly<Record<string, unknown>>): ChangeResult => change(item, values);

export function setPlace(item: MapElement, { x: atX, y: atY, w: width, h: height }: Place): ChangeResult {
  const values: Record<string, string> = { x: tidy(atX), y: tidy(atY) };
  if (kindOf(item.tag)?.shape === SHAPE.RECT) Object.assign(values, { w: tidy(width as number), h: tidy(height as number) });
  return change(item, values);
}

export function addElement(tag: string, { x: atX, y: atY, w: width = NEW_RECT, h: height = NEW_RECT }: Place): MapElement {
  if (NOT_PLACED.has(tag)) throw new Error(TEXT.notAddedByHand((kindOf(tag) as Kind).title));
  const kind = kindOf(tag);
  if (!kind) throw new Error(TEXT.cannotAdd(tag));
  const doc = currentDoc();
  const uid = newUid(doc, tag);
  const place: Attrs = kind.shape === SHAPE.RECT ? { x: tidy(atX), y: tidy(atY), w: tidy(width), h: tidy(height) } : { x: tidy(atX), y: tidy(atY) };
  const item = newElement(tag, { ...(uid ? { uid } : {}), ...place, ...DEFAULTS[tag] });
  insert(item);
  select(item);
  return item;
}

export function deleteElement(item: MapElement): void {
  remove(item);
}

export function duplicateElement(item: MapElement): MapElement {
  if (NOT_PLACED.has(item.tag)) throw new Error(TEXT.notCopiedByHand((kindOf(item.tag) as Kind).title));
  const attrs: Attrs = { ...item.attrs, x: tidy(Number(item.attrs.x) + DUPLICATE_OFFSET), y: tidy(Number(item.attrs.y) + DUPLICATE_OFFSET) };
  if (attrs.uid) attrs.uid = newUid(currentDoc(), item.tag) as string;
  const copy = newElement(item.tag, attrs);
  insert(copy);
  select(copy);
  return copy;
}

export function applyPlan(plan: LoadPlan): NotLive[] {
  const doc = currentDoc();
  const notLive: NotLive[] = [];
  beginAction();
  try {
    for (const { target, values } of plan.replace) {
      const result = change(target, values);
      if (!result.live) notLive.push({ name: nameOf(doc, target), why: result.why ?? '' });
    }
    for (const item of plan.remove) remove(item);
    for (const item of plan.add) {
      insert(item);
      if (isPending(item)) notLive.push({ name: nameOf(doc, item), why: lastWhy });
    }
  } finally {
    endAction();
  }
  return notLive;
}

function play(entry: Entry, backwards: boolean): void {
  const steps = backwards ? [...entry].reverse() : entry;
  for (const step of steps) {
    const quiet = { recorded: false };
    if (step.kind === CHANGE.attrs) change(step.element, backwards ? step.before : step.after, quiet);
    else if ((step.kind === CHANGE.insert) !== backwards) insert(step.element, step.at, quiet);
    else remove(step.element, quiet);
  }
  const last = steps[steps.length - 1];
  if (!last) return;
  const gone = (last.kind === CHANGE.insert) === backwards;
  select(gone ? null : last.element);
}

export function undo(): boolean {
  const entry = takeUndo();
  if (entry) play(entry, true);
  return !!entry;
}
export function redo(): boolean {
  const entry = takeRedo();
  if (entry) play(entry, false);
  return !!entry;
}

export function resetEdits(): { undone: number; notBack: number } {
  let undone = 0;
  let notBack = 0;
  if (docInLevel()) {
    while (undo()) {
      undone++;
      if (lastWhy) notBack++;
    }
  }
  lastWhy = '';
  resetDocument();
  return { undone, notBack };
}

export function editSummary(): EditSummary | null {
  const doc = editorDoc();
  const original = doc && MapDoc.of(doc.source);
  if (!doc || !original) return null;
  const byIndex = new Map(original.elements.map((item) => [liveKey(item.tag, item.live?.index), item]));
  const seen = new Set<string>();
  let changed = 0;
  let added = 0;
  for (const item of doc.elements) {
    const key = item.live && item.live.index !== undefined ? liveKey(item.tag, item.live.index) : null;
    const was = key && !seen.has(key) ? byIndex.get(key) : null;
    if (!key || !was) {
      added++;
      continue;
    }
    seen.add(key);
    const attrs = new Set([...Object.keys(item.attrs), ...Object.keys(was.attrs)]);
    if ([...attrs].some((attr) => item.attrs[attr] !== was.attrs[attr])) changed++;
  }
  const deleted = byIndex.size - seen.size;
  if (!changed && !added && !deleted) return null;
  return { changed, added, deleted, inLevel: docInLevel() };
}

function replayEdits(): void {
  const doc = currentDoc();
  const original = MapDoc.of(doc.source);
  if (!original) return;
  const byIndex = new Map<string, MapElement>();
  for (const item of original.elements) byIndex.set(liveKey(item.tag, item.live?.index), item);
  const added: MapElement[] = [];
  for (const item of doc.elements) {
    if (!item.live || item.live.index === undefined) continue;
    const was = byIndex.get(liveKey(item.tag, item.live.index));
    if (!was) {
      added.push(item);
      continue;
    }
    for (const attr of new Set([...Object.keys(item.attrs), ...Object.keys(was.attrs)])) {
      if (item.attrs[attr] !== was.attrs[attr] && !applyLive(item, attr).live) markPending(item);
    }
  }
  for (const item of takenOut) {
    try {
      removeLive(item);
    } catch {
      markPending(item);
    }
  }
  for (const item of added.sort((first, second) => (first.live?.index as number) - (second.live?.index as number))) {
    try {
      addToLevel(item);
    } catch {
      markPending(item);
    }
  }
}

onChange((what) => {
  if (what === NOTICE.doc) {
    clearHistory();
    takenOut.clear();
    forgetGuns();
    forgetLamps();
  }
  if (what === NOTICE.reloaded) {
    forgetGuns();
    forgetLamps();
    replayEdits();
  }
});

export const saveMap = (name: string, { overwrite = false }: { overwrite?: boolean } = {}): Promise<{ file: string; id: string }> => saveText(name, currentDoc().toText(), { overwrite });

export async function saveText(name: string, body: string, { overwrite = false }: { overwrite?: boolean } = {}): Promise<{ file: string; id: string }> {
  if (!SAVE_NAME.test(name)) throw new Error(TEXT.badSaveName);
  const url = saveUrl(ROUTE.saveEdited, name, overwrite);
  const response = await fetch(url, { method: SAVE_METHOD, body });
  const text = await response.text();
  if (!response.ok) throw new Error(text || TEXT.httpStatus(response.status));
  return JSON.parse(text) as { file: string; id: string };
}

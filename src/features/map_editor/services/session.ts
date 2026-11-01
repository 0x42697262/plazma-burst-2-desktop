import { game } from '#console/kernel/game/bindings.ts';
import { isActive, requireLevel } from '#console/kernel/game/level.ts';
import { MapDoc, type MapElement, type Spot } from '../domain/doc.ts';
import { KIND_TAGS, kindOf, type Box } from '../domain/kinds.ts';
import { TAG } from '../domain/keys.ts';
import { liveBounds } from './live.ts';
import { readLoader, loaderReady } from './loader.ts';
import { HALF, PICK_SLOP, SAME_SPOT } from './constants.ts';
import { NOTICE, TOOL, type Notice, type Tool } from './keys.ts';
import { SERVICES_TEXT as TEXT } from './text.ts';

export { TOOL, NOTICE, type Notice, type Tool };

export type Pick = { kinds: readonly string[]; what: string; onPick: (item: MapElement) => void };
export type Preview = Box & { tag: string };
export type Visible = { item: MapElement; bounds: Box; selectable: boolean };
type LastPick = { at: Spot; ids: number[]; position: number };
type Listener = (what: Notice) => void;

const listeners = new Set<Listener>();
const state: {
  on: boolean;
  shown: boolean;
  pending: Set<number>;
  doc: MapDoc | null;
  selectedId: number | null;
  layer: string;
  selectable: Set<string>;
  moreLayers: boolean;
  pick: Pick | null;
  levelStarts: number;
  levelRunning: boolean;
  docLevel: number;
  tool: Tool;
  preview: Preview | null;
  lastPick: LastPick | null;
} = {
  on: false,
  shown: false,
  pending: new Set(),
  doc: null,
  selectedId: null,
  layer: TAG.region,
  selectable: new Set(KIND_TAGS),
  moreLayers: false,
  pick: null,
  levelStarts: 0,
  levelRunning: false,
  docLevel: -1,
  tool: TOOL.SELECT,
  preview: null,
  lastPick: null,
};

export const onChange = (listener: Listener): (() => boolean) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};
export const notify = (what: Notice): void => {
  for (const listener of listeners) listener(what);
};
const changed = notify;

export const editorOn = (): boolean => state.on;
export const editorShown = (): boolean => state.shown;
export const pendingCount = (): number => state.pending.size;
export const markPending = (item: MapElement): void => {
  state.pending.add(item.id);
};
export const isPending = (item: MapElement): boolean => state.pending.has(item.id);
export const editorDoc = (): MapDoc | null => state.doc;
export const currentLayer = (): string => state.layer;
export const isSelectable = (tag: string): boolean => state.selectable.has(tag);
export const selectableLayers = (): string[] => [...state.selectable];
export const moreLayers = (): boolean => state.moreLayers;
export const currentPick = (): Pick | null => state.pick;

export function startPick(kinds: readonly string[], what: string, onPick: (item: MapElement) => void): void {
  state.pick = { kinds, what, onPick };
  changed(NOTICE.pick);
}

export function cancelPick(): boolean {
  if (!state.pick) return false;
  state.pick = null;
  changed(NOTICE.pick);
  return true;
}

const contains = (bounds: Box, point: Spot, slop: number): boolean => point.x >= bounds.x - slop && point.x <= bounds.x + bounds.w + slop
  && point.y >= bounds.y - slop && point.y <= bounds.y + bounds.h + slop;

export function pickTargetAt(point: Spot, reach: number): MapElement | null {
  if (!state.pick || !state.doc) return null;
  let best: { item: MapElement; distance: number } | null = null;
  for (const item of state.doc.elements) {
    if (!state.pick.kinds.includes(item.tag)) continue;
    const bounds = liveBounds(state.doc, item);
    if (!bounds) continue;
    const distance = Math.hypot(bounds.x + bounds.w / HALF - point.x, bounds.y + bounds.h / HALF - point.y);
    if ((distance <= reach || contains(bounds, point, 0)) && (!best || distance < best.distance)) best = { item, distance };
  }
  return best && best.item;
}

export function finishPick(item: MapElement | null): boolean {
  const pick = state.pick;
  if (!pick || !item) return false;
  state.pick = null;
  pick.onPick(item);
  changed(NOTICE.pick);
  return true;
}
export const currentTool = (): Tool => state.tool;
export const placePreview = (): Preview | null => state.preview;

export function setTool(tool: Tool): void {
  if (tool === state.tool) return;
  state.tool = tool;
  state.preview = null;
  changed(NOTICE.tool);
}

export function setPreview(rect: Preview | null): void {
  state.preview = rect;
}
export const selected = (): MapElement | null => (state.doc && state.selectedId !== null ? state.doc.byId(state.selectedId) : null);

function readDoc(): MapDoc {
  const doc = MapDoc.of(game.mapText());
  if (!doc) throw new Error(TEXT.mapNotReadable);
  return doc;
}

function setShown(shown: boolean): void {
  if (shown === state.shown) return;
  state.shown = shown;
  state.lastPick = null;
  changed(NOTICE.shown);
}

function takeDoc(doc: MapDoc): void {
  state.doc = doc;
  state.docLevel = state.levelStarts;
  state.selectedId = null;
  state.lastPick = null;
  state.pending.clear();
  changed(NOTICE.doc);
}

export function setEditor(on: boolean): boolean {
  if (on === state.on) return false;
  if (on) {
    requireLevel();
    const text = game.mapText();
    if (state.doc && state.doc.source === text) {
      if (state.docLevel !== state.levelStarts) {
        state.docLevel = state.levelStarts;
        changed(NOTICE.reloaded);
      }
    } else {
      takeDoc(readDoc());
    }
    if (!loaderReady()) void readLoader();
  }
  state.on = on;
  setShown(on);
  return true;
}

export const docInLevel = (): boolean => !!state.doc && state.levelRunning && state.doc.source === game.mapText()
  && state.docLevel === state.levelStarts;

export function resetDocument(): void {
  const doc = state.on ? MapDoc.of(game.mapText()) : null;
  if (doc) {
    takeDoc(doc);
    return;
  }
  state.doc = null;
  state.selectedId = null;
  state.pending.clear();
  changed(NOTICE.doc);
}

export function forgetDocument(): void {
  if (!state.on) {
    state.doc = null;
    state.selectedId = null;
  }
}

export function select(item: MapElement | null): void {
  const id = item ? item.id : null;
  if (id === state.selectedId) return;
  state.selectedId = id;
  state.pick = null;
  if (item && kindOf(item.tag)) state.layer = item.tag;
  changed(NOTICE.selection);
}

export function showLayer(tag: string): void {
  if (!kindOf(tag)) return;
  state.layer = tag;
  changed(NOTICE.layer);
}

export const LAYER_GROUPS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  statics: [TAG.bg, TAG.box, TAG.lamp, TAG.water, TAG.pushf],
  logics: [TAG.trigger, TAG.timer, TAG.inf, TAG.region, TAG.door, TAG.pushf],
  entities: [TAG.player, TAG.enemy, TAG.vehicle, TAG.decor, TAG.gun, TAG.barrel, TAG.inf],
});

export function setSelectable(tags: readonly (string | null)[]): void {
  state.selectable = new Set(tags.filter((tag): tag is string => !!tag && !!kindOf(tag)));
  const current = selected();
  if (current && !state.selectable.has(current.tag)) state.selectedId = null;
  state.lastPick = null;
  changed(NOTICE.layers);
}

export function setMoreLayers(on: boolean): void {
  state.moreLayers = on;
  changed(NOTICE.layers);
}

export function* visibleElements(): Generator<Visible> {
  if (!state.doc) return;
  for (const item of state.doc.elements) {
    if (!kindOf(item.tag)) continue;
    const bounds = liveBounds(state.doc, item);
    if (bounds) yield { item, bounds, selectable: state.selectable.has(item.tag) };
  }
}

export const countByTag = (): Record<string, number> => {
  const counts: Record<string, number> = Object.fromEntries(KIND_TAGS.map((tag) => [tag, 0]));
  for (const item of state.doc?.elements || []) if (item.tag in counts) counts[item.tag] = (counts[item.tag] ?? 0) + 1;
  return counts;
};

function hitsAt(point: Spot): MapElement[] {
  return [...visibleElements()].filter(({ bounds, selectable }) => selectable && contains(bounds, point, PICK_SLOP))
    .sort((first, second) => first.bounds.w * first.bounds.h - second.bounds.w * second.bounds.h)
    .map(({ item }) => item);
}

export const elementAt = (point: Spot): MapElement | null => hitsAt(point)[0] || null;

export function pickAt(point: Spot): MapElement | null {
  const hits = hitsAt(point).map((item) => item.id);
  const last = state.lastPick;
  const again = !!last && Math.hypot(last.at.x - point.x, last.at.y - point.y) <= SAME_SPOT
    && last.ids.length === hits.length && last.ids.every((id, position) => id === hits[position]);
  const position = again && last ? (last.position + 1) % hits.length : 0;
  state.lastPick = hits.length ? { at: point, ids: hits, position } : null;
  const item = hits.length ? (state.doc as MapDoc).byId(hits[position] as number) : null;
  select(item);
  return item;
}

export function editorTick(): void {
  const active = isActive();
  if (active && !state.levelRunning) state.levelStarts++;
  state.levelRunning = active;
  if (!state.on) return;
  if (active === state.shown) return;
  if (active) {
    const text = game.mapText();
    if (text !== (state.doc as MapDoc).source) {
      const doc = MapDoc.of(text);
      if (!doc) return;
      takeDoc(doc);
    } else {
      state.docLevel = state.levelStarts;
      changed(NOTICE.reloaded);
    }
  }
  setShown(active);
}

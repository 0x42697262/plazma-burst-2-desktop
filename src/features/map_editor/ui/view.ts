import { GAME_WIDTH, GAME_HEIGHT } from '#console/kernel/game/bindings.ts';
import { setLayer, drawOverlay, toScreen, crosshair, type Transform } from '#console/kernel/ui/overlay.ts';
import { drawLabels, type LabelItem } from '#console/kernel/ui/labels.ts';
import { buildGraph, nameless, type Graph, type GraphNode, type Link } from '#features/triggers/logic/graph.ts';
import { kindOf, type Box, type Kind } from '../domain/kinds.ts';
import type { MapDoc, MapElement } from '../domain/doc.ts';
import { liveBounds } from '../services/live.ts';
import { editorDoc, selected, visibleElements, placePreview, currentPick, isSelectable, type Pick } from '../services/session.ts';
import { HALF, LINE_WIDTH, LINK, PICK_MARKER, PREVIEW_DASH, SELECTED_WIDTH } from './constants.ts';
import {
  INACTIVE_ALPHA, LAYER_NAME, LINK_COLOR, OUTLINE_ALPHA, PICK_FALLBACK_COLOR, PICK_IMAGES, PICK_IMAGE_STATE, SELECTED_FALLBACK_COLOR, SELECTED_FILL,
  type PickImageState,
} from './keys.ts';
import { VIEW_TEXT as TEXT } from './text.ts';

type Point = { x: number; y: number };
type End = { point: Point; uid: string; active: boolean };
type ScreenLink = { from: End; to: End; out: boolean };
type DocGraph = { doc: MapDoc | null; version: number; graph: Graph | null; elements: Map<string, MapElement> | null };
export type EditorDrawn = { outlines: number; selected: number | null; links: number; picks: number };

const BOUNDS = Object.freeze({ w: GAME_WIDTH, h: GAME_HEIGHT });

const centre = (bounds: Box): Point => ({ x: bounds.x + bounds.w / HALF, y: bounds.y + bounds.h / HALF });
const onScreenRect = (rect: Box): boolean => rect.x + rect.w >= 0 && rect.x <= GAME_WIDTH && rect.y + rect.h >= 0 && rect.y <= GAME_HEIGHT;

function screenRect(transform: Transform, bounds: Box): Box {
  const topLeft = toScreen(transform, bounds);
  const bottomRight = toScreen(transform, { x: bounds.x + bounds.w, y: bounds.y + bounds.h });
  return {
    x: Math.min(topLeft.x, bottomRight.x), y: Math.min(topLeft.y, bottomRight.y),
    w: Math.abs(bottomRight.x - topLeft.x), h: Math.abs(bottomRight.y - topLeft.y),
  };
}

let graphOf: DocGraph = { doc: null, version: -1, graph: null, elements: null };
const keyOf = (doc: MapDoc, item: MapElement): string => item.attrs.uid || nameless(item.tag, doc.ordinal(item) as number);

function docGraph(doc: MapDoc): { graph: Graph; elements: Map<string, MapElement> } {
  if (graphOf.doc !== doc || graphOf.version !== doc.version) {
    const elements = new Map<string, MapElement>();
    for (const item of doc.elements) {
      const key = keyOf(doc, item);
      if (!elements.has(key)) elements.set(key, item);
    }
    graphOf = { doc, version: doc.version, graph: buildGraph(doc.toText()), elements };
  }
  return { graph: graphOf.graph as Graph, elements: graphOf.elements as Map<string, MapElement> };
}

function selectionLinks(transform: Transform, doc: MapDoc, current: MapElement): ScreenLink[] {
  const { graph, elements } = docGraph(doc);
  const key = keyOf(doc, current);
  const at = (node: GraphNode): End | null => {
    const item = elements.get(node.uid);
    const bounds = item && liveBounds(doc, item);
    return item && bounds ? { point: toScreen(transform, centre(bounds)), uid: node.uid, active: isSelectable(item.tag) } : null;
  };
  const out = (graph.outOf.get(key) || []).map((link: Link) => ({ from: at(link.from), to: at(link.to), out: true }));
  const into = (graph.into.get(key) || []).map((link: Link) => ({ from: at(link.to), to: at(link.from), out: false }));
  return [...out, ...into].filter((link): link is ScreenLink => !!link.from && !!link.to);
}

function drawConnection(context: CanvasRenderingContext2D, link: ScreenLink): void {
  context.save();
  context.globalAlpha = link.to.active ? 1 : LINK.inactiveAlpha;
  context.strokeStyle = link.out ? LINK_COLOR.out : LINK_COLOR.in;
  context.lineWidth = LINK.width;
  context.setLineDash([...LINK.dash]);
  context.beginPath();
  context.moveTo(link.from.point.x, link.from.point.y);
  context.lineTo(link.to.point.x, link.to.point.y);
  context.stroke();
  context.restore();
}

let pickImages: Record<PickImageState, HTMLImageElement> | null = null;
function pickImage(which: PickImageState): HTMLImageElement | null {
  if (typeof Image === 'undefined') return null;
  pickImages ??= {
    idle: Object.assign(new Image(), { src: PICK_IMAGES.idle }),
    over: Object.assign(new Image(), { src: PICK_IMAGES.over }),
  };
  const image = pickImages[which];
  return image.complete && image.naturalWidth ? image : null;
}

function drawPickMarkers(context: CanvasRenderingContext2D, transform: Transform, doc: MapDoc, pick: Pick): number {
  const time = performance.now() / PICK_MARKER.timeScale;
  const size = PICK_MARKER.size + Math.sin(time) * PICK_MARKER.pulse;
  const pointer = crosshair(transform);
  let over: { item: MapElement; distance: number } | null = null;
  const marks: { item: MapElement; point: Point }[] = [];
  for (const item of doc.elements) {
    if (!pick.kinds.includes(item.tag)) continue;
    const bounds = liveBounds(doc, item);
    if (!bounds) continue;
    const point = toScreen(transform, centre(bounds));
    if (point.x < -size || point.x > GAME_WIDTH + size || point.y < -size || point.y > GAME_HEIGHT + size) continue;
    const distance = pointer ? Math.hypot(point.x - pointer.x, point.y - pointer.y) : Infinity;
    if (distance <= PICK_MARKER.reach && (!over || distance < over.distance)) over = { item, distance };
    marks.push({ item, point });
  }
  context.save();
  context.globalAlpha = PICK_MARKER.alpha - Math.sin(time) / PICK_MARKER.alphaSwing;
  for (const { item, point } of marks) {
    const image = pickImage(over && over.item === item ? PICK_IMAGE_STATE.over : PICK_IMAGE_STATE.idle);
    if (image) context.drawImage(image, point.x - size, point.y - size, size * HALF, size * HALF);
    else {
      context.strokeStyle = PICK_FALLBACK_COLOR;
      context.lineWidth = SELECTED_WIDTH;
      context.beginPath();
      context.arc(point.x, point.y, size / HALF, 0, Math.PI * HALF);
      context.stroke();
    }
  }
  context.restore();
  return marks.length;
}

function drawEditor(context: CanvasRenderingContext2D, transform: Transform): EditorDrawn | null {
  const doc = editorDoc();
  if (!doc) return null;
  const current = selected();
  let outlines = 0;
  context.lineWidth = LINE_WIDTH;
  for (const { item, bounds, selectable } of visibleElements()) {
    if (item === current) continue;
    const rect = screenRect(transform, bounds);
    if (!onScreenRect(rect)) continue;
    context.strokeStyle = (kindOf(item.tag) as Kind).color + (selectable ? OUTLINE_ALPHA : INACTIVE_ALPHA);
    context.strokeRect(rect.x, rect.y, rect.w, rect.h);
    outlines++;
  }
  const labels: LabelItem[] = [];
  let links = 0;
  if (current) {
    const bounds = liveBounds(doc, current);
    if (bounds) {
      const rect = screenRect(transform, bounds);
      const color = kindOf(current.tag)?.color || SELECTED_FALLBACK_COLOR;
      context.fillStyle = color + SELECTED_FILL;
      context.fillRect(rect.x, rect.y, rect.w, rect.h);
      context.lineWidth = SELECTED_WIDTH;
      context.strokeStyle = color;
      context.strokeRect(rect.x, rect.y, rect.w, rect.h);
      labels.push({ ...centre(rect), text: keyOf(doc, current) });
    }
    for (const link of selectionLinks(transform, doc, current)) {
      drawConnection(context, link);
      labels.push({ ...link.to.point, text: link.to.uid });
      links++;
    }
  }
  const preview = placePreview();
  if (preview) {
    const rect = screenRect(transform, preview);
    context.setLineDash([...PREVIEW_DASH]);
    context.lineWidth = SELECTED_WIDTH;
    context.strokeStyle = (kindOf(preview.tag) as Kind).color;
    context.strokeRect(rect.x, rect.y, rect.w, rect.h);
    context.setLineDash([]);
    labels.push({ x: rect.x + rect.w, y: rect.y + rect.h, text: TEXT.previewSize(Math.round(preview.w), Math.round(preview.h)) });
  }
  const pick = currentPick();
  const picks = pick ? drawPickMarkers(context, transform, doc, pick) : 0;
  drawLabels(context, labels, crosshair(transform), BOUNDS);
  return { outlines, selected: current ? current.id : null, links, picks };
}

export const showEditorView = (on: boolean): void => {
  setLayer(LAYER_NAME, on ? drawEditor : null);
};

export function drawEditorFrame(): EditorDrawn | null {
  const drawn = drawOverlay();
  return drawn ? drawn[LAYER_NAME] as EditorDrawn | undefined ?? null : null;
}

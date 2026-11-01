import { GAME_WIDTH, GAME_HEIGHT } from '#console/kernel/game/bindings.ts';
import { setLayer, hasLayer, drawOverlay, currentTransform, toScreen, onScreen, crosshair, type Transform } from '#console/kernel/ui/overlay.ts';
import { drawLabels, type LabelItem } from '#console/kernel/ui/labels.ts';
import { ARROW, ARROW_SPREAD, HALF, LINE_WIDTH, NODE_SIZE } from './constants.ts';
import { LAYER, LINK_COLOR, NODE_COLOR, OTHER_NODE_COLOR, type LinkKind } from './keys.ts';
import { logicGraph, placeOf, centerOf, type GraphNode, type Link } from './graph.ts';

type Point = { x: number; y: number };
export type LinkFilter = (link: Link) => boolean;
export type LogicDrawn = { lines: number; nodes: number; labels: { shown: number; hidden: number } };

const BOUNDS = Object.freeze({ w: GAME_WIDTH, h: GAME_HEIGHT });

let filter: LinkFilter | null = null;
let screenOnly = false;
let shownAs = '';

function visibleWith(transform: Transform, node: GraphNode): boolean {
  const place = placeOf(node);
  if (!Number.isFinite(place.x) || !Number.isFinite(place.y)) return false;
  const corner = { x: place.x as number, y: place.y as number };
  const topLeft = toScreen(transform, corner);
  const hasSize = Number.isFinite(place.w) && Number.isFinite(place.h);
  const bottomRight = hasSize ? toScreen(transform, { x: corner.x + (place.w as number), y: corner.y + (place.h as number) }) : topLeft;
  return Math.max(topLeft.x, bottomRight.x) >= 0 && Math.min(topLeft.x, bottomRight.x) <= GAME_WIDTH
    && Math.max(topLeft.y, bottomRight.y) >= 0 && Math.min(topLeft.y, bottomRight.y) <= GAME_HEIGHT;
}

export function isVisible(node: GraphNode): boolean {
  const transform = currentTransform();
  return !!transform && visibleWith(transform, node);
}

function arrowHead(context: CanvasRenderingContext2D, from: Point, to: Point): void {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  context.beginPath();
  context.moveTo(to.x, to.y);
  context.lineTo(to.x - ARROW * Math.cos(angle - ARROW_SPREAD), to.y - ARROW * Math.sin(angle - ARROW_SPREAD));
  context.lineTo(to.x - ARROW * Math.cos(angle + ARROW_SPREAD), to.y - ARROW * Math.sin(angle + ARROW_SPREAD));
  context.closePath();
  context.fill();
}

export function drawLink(context: CanvasRenderingContext2D, from: Point, to: Point, kind: LinkKind): void {
  context.lineWidth = LINE_WIDTH;
  context.strokeStyle = context.fillStyle = LINK_COLOR[kind];
  context.beginPath();
  context.moveTo(from.x, from.y);
  context.lineTo(to.x, to.y);
  context.stroke();
  arrowHead(context, from, to);
}

function drawNode(context: CanvasRenderingContext2D, transform: Transform, node: GraphNode, point: Point): void {
  const place = placeOf(node);
  context.strokeStyle = context.fillStyle = NODE_COLOR[node.tag] || OTHER_NODE_COLOR;
  if (Number.isFinite(place.w) && Number.isFinite(place.h)) {
    const topLeft = toScreen(transform, { x: place.x as number, y: place.y as number });
    const bottomRight = toScreen(transform, { x: (place.x as number) + (place.w as number), y: (place.y as number) + (place.h as number) });
    context.strokeRect(topLeft.x, topLeft.y, bottomRight.x - topLeft.x, bottomRight.y - topLeft.y);
  } else {
    context.fillRect(point.x - NODE_SIZE / HALF, point.y - NODE_SIZE / HALF, NODE_SIZE, NODE_SIZE);
  }
}

function drawLogic(context: CanvasRenderingContext2D, transform: Transform): LogicDrawn | null {
  const graph = logicGraph();
  if (!graph) return null;
  const points = new Map<GraphNode, Point>();
  const pointOf = (node: GraphNode): Point => {
    const known = points.get(node);
    if (known) return known;
    const point = toScreen(transform, centerOf(placeOf(node)));
    points.set(node, point);
    return point;
  };
  const visibility = new Map<GraphNode, boolean>();
  const visible = (node: GraphNode): boolean => {
    const known = visibility.get(node);
    if (known !== undefined) return known;
    const isShown = visibleWith(transform, node);
    visibility.set(node, isShown);
    return isShown;
  };
  const shown = new Set<GraphNode>();
  let lines = 0;
  for (const link of graph.links) {
    if (filter && !filter(link)) continue;
    const from = pointOf(link.from);
    const to = pointOf(link.to);
    if (![from.x, from.y, to.x, to.y].every(Number.isFinite)) continue;
    const isOnScreen = screenOnly ? visible(link.from) && visible(link.to) : onScreen(from) || onScreen(to);
    if (!isOnScreen) continue;
    drawLink(context, from, to, link.kind);
    shown.add(link.from).add(link.to);
    lines++;
  }
  const items: LabelItem[] = [];
  for (const node of shown) {
    const point = pointOf(node);
    if (!onScreen(point)) continue;
    drawNode(context, transform, node, point);
    items.push({ x: point.x, y: point.y, text: node.uid });
  }
  const labels = drawLabels(context, items, crosshair(transform), BOUNDS);
  return { lines, nodes: shown.size, labels };
}

export function drawFrame(): unknown {
  const drawn = drawOverlay();
  return drawn ? drawn[LAYER] ?? null : null;
}

export function showLogic(linkFilter: LinkFilter | null, { screen = false, describe = '' }: { screen?: boolean; describe?: string } = {}): void {
  filter = linkFilter;
  screenOnly = screen;
  shownAs = describe;
  setLayer(LAYER, drawLogic);
}

export function hideLogic(): void {
  setLayer(LAYER, null);
  filter = null;
  screenOnly = false;
  shownAs = '';
}

export const logicShown = (): boolean => hasLayer(LAYER);
export const logicDescription = (): string => shownAs;

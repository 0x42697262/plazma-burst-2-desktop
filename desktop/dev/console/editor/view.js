// The editor over the game: an outline for every element on a shown layer, in its
// layer's colour, the selection highlighted, the selection's logic links drawn the way
// "logic show" draws them (uids at both ends), and the rectangle being placed.
import { GAME_WIDTH, GAME_HEIGHT } from '../game/bindings.js';
import { setLayer, drawOverlay, toScreen, crosshair } from '../ui/overlay.js';
import { drawLabels } from '../ui/labels.js';
import { buildGraph, nameless } from '../logic/graph.js';
import { drawLink } from '../logic/view.js';
import { kindOf } from './kinds.js';
import { liveBounds } from './live.js';
import { editorDoc, selected, visibleElements, placePreview } from './session.js';

const LAYER = 'editor';
const LINE_WIDTH = 0.4; // screen units
const SELECTED_WIDTH = 1.2;
const OUTLINE_ALPHA = '99'; // hex alpha on the layer colour
const SELECTED_FILL = '22';
const BOUNDS = Object.freeze({ w: GAME_WIDTH, h: GAME_HEIGHT });
const PREVIEW_DASH = Object.freeze([2, 2]);

const centre = (b) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
const onScreenRect = (r) => r.x + r.w >= 0 && r.x <= GAME_WIDTH && r.y + r.h >= 0 && r.y <= GAME_HEIGHT;

function screenRect(m, b) {
  const tl = toScreen(m, b);
  const br = toScreen(m, { x: b.x + b.w, y: b.y + b.h });
  return { x: Math.min(tl.x, br.x), y: Math.min(tl.y, br.y), w: Math.abs(br.x - tl.x), h: Math.abs(br.y - tl.y) };
}

// The logic graph of the document as it is now, built again only after a change, and
// which element each node is. A node is named by uid, or "<tag>#<index>" without one.
let graphOf = { doc: null, version: -1, graph: null, elements: null };
const keyOf = (doc, e) => e.attrs.uid || nameless(e.tag, doc.ordinal(e));
function docGraph(doc) {
  if (graphOf.doc !== doc || graphOf.version !== doc.version) {
    const elements = new Map();
    for (const e of doc.elements) { const k = keyOf(doc, e); if (!elements.has(k)) elements.set(k, e); }
    graphOf = { doc, version: doc.version, graph: buildGraph(doc.toText()), elements };
  }
  return graphOf;
}

// The selection's links, both ways: [{ from, to, kind }] with screen points and names.
function selectionLinks(m, doc, sel) {
  const { graph: g, elements } = docGraph(doc);
  const key = keyOf(doc, sel);
  const links = [...(g.outOf.get(key) || []), ...(g.into.get(key) || [])];
  const at = (node) => {
    const e = elements.get(node.uid);
    const b = e && liveBounds(doc, e);
    return b ? { point: toScreen(m, centre(b)), uid: node.uid } : null;
  };
  return links.map((l) => ({ from: at(l.from), to: at(l.to), kind: l.kind })).filter((l) => l.from && l.to);
}

function drawEditor(ctx, m) {
  const doc = editorDoc();
  if (!doc) return null;
  const sel = selected();
  let outlines = 0;
  ctx.lineWidth = LINE_WIDTH;
  for (const { e, b } of visibleElements()) {
    if (e === sel) continue;
    const r = screenRect(m, b);
    if (!onScreenRect(r)) continue;
    ctx.strokeStyle = kindOf(e.tag).color + OUTLINE_ALPHA;
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    outlines++;
  }
  const labels = [];
  let links = 0;
  if (sel) {
    const b = liveBounds(doc, sel);
    if (b) {
      const r = screenRect(m, b);
      const color = kindOf(sel.tag)?.color || '#ffffff';
      ctx.fillStyle = color + SELECTED_FILL;
      ctx.fillRect(r.x, r.y, r.w, r.h);
      ctx.lineWidth = SELECTED_WIDTH;
      ctx.strokeStyle = color;
      ctx.strokeRect(r.x, r.y, r.w, r.h);
      labels.push({ ...centre(r), text: keyOf(doc, sel) });
    }
    for (const l of selectionLinks(m, doc, sel)) {
      drawLink(ctx, l.from.point, l.to.point, l.kind);
      for (const end of [l.from, l.to]) if (end.uid !== keyOf(doc, sel)) labels.push({ ...end.point, text: end.uid });
      links++;
    }
  }
  const preview = placePreview();
  if (preview) {
    const r = screenRect(m, preview);
    ctx.setLineDash(PREVIEW_DASH);
    ctx.lineWidth = SELECTED_WIDTH;
    ctx.strokeStyle = kindOf(preview.tag).color;
    ctx.strokeRect(r.x, r.y, r.w, r.h);
    ctx.setLineDash([]);
    labels.push({ x: r.x + r.w, y: r.y + r.h, text: `${Math.round(preview.w)} x ${Math.round(preview.h)}` });
  }
  drawLabels(ctx, labels, crosshair(m), BOUNDS);
  return { outlines, selected: sel ? sel.id : null, links };
}

export const showEditorView = (on) => setLayer(LAYER, on ? drawEditor : null);

// One frame of the overlay, and what the editor layer drew (for tests).
export function drawEditorFrame() {
  const out = drawOverlay();
  return out ? out[LAYER] ?? null : null;
}

// The editor over the game: an outline for every element on a shown layer, in its
// layer's colour, the selection highlighted, and the selection's logic links drawn the
// way "logic show" draws them, with the uids at both ends.
import { GAME_WIDTH, GAME_HEIGHT } from '../game/bindings.js';
import { setLayer, drawOverlay, toScreen, crosshair } from '../ui/overlay.js';
import { drawLabels } from '../ui/labels.js';
import { buildGraph } from '../logic/graph.js';
import { drawLink } from '../logic/view.js';
import { kindOf } from './kinds.js';
import { liveBounds } from './live.js';
import { editorDoc, selected, visibleElements } from './session.js';

const LAYER = 'editor';
const LINE_WIDTH = 0.4; // screen units
const SELECTED_WIDTH = 1.2;
const OUTLINE_ALPHA = '99'; // hex alpha on the layer colour
const SELECTED_FILL = '22';
const BOUNDS = Object.freeze({ w: GAME_WIDTH, h: GAME_HEIGHT });

const centre = (b) => ({ x: b.x + b.w / 2, y: b.y + b.h / 2 });
const onScreenRect = (r) => r.x + r.w >= 0 && r.x <= GAME_WIDTH && r.y + r.h >= 0 && r.y <= GAME_HEIGHT;

function screenRect(m, b) {
  const tl = toScreen(m, b);
  const br = toScreen(m, { x: b.x + b.w, y: b.y + b.h });
  return { x: Math.min(tl.x, br.x), y: Math.min(tl.y, br.y), w: Math.abs(br.x - tl.x), h: Math.abs(br.y - tl.y) };
}

// The logic graph of the document as it is now, built again only after a change.
let graphOf = { doc: null, version: -1, graph: null };
function docGraph(doc) {
  if (graphOf.doc !== doc || graphOf.version !== doc.version) graphOf = { doc, version: doc.version, graph: buildGraph(doc.toText()) };
  return graphOf.graph;
}

// The selection's links, both ways: [{ from, to, kind }] with screen points.
function selectionLinks(m, doc, sel) {
  if (!sel.attrs.uid) return [];
  const g = docGraph(doc);
  const links = [...(g.outOf.get(sel.attrs.uid) || []), ...(g.into.get(sel.attrs.uid) || [])];
  const at = (node) => {
    const e = doc.byUid(node.uid);
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
      if (sel.attrs.uid) labels.push({ ...centre(r), text: sel.attrs.uid });
    }
    for (const l of selectionLinks(m, doc, sel)) {
      drawLink(ctx, l.from.point, l.to.point, l.kind);
      for (const end of [l.from, l.to]) if (end.uid !== sel.attrs.uid) labels.push({ ...end.point, text: end.uid });
      links++;
    }
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

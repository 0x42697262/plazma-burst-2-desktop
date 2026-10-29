// Labels over the game (uids in the logic view, names in traces), placed so they never
// pile up. Points that sit
// within a few units of each other share one label, one uid per line; a big group shows
// its first lines and "+N more", and opens fully while the crosshair is on it. Each
// label takes the first free spot around its point, nearest the crosshair first; one
// with no free spot is hidden (zoomed far out there is no room for every label), and
// the crosshair opens it like any other. layoutLabels is pure: points in, boxes out.

export const FONT_SIZE = 5; // game units
const CHAR_WIDTH = FONT_SIZE * 0.61; // DejaVuSansMono is monospaced: every character this wide
export const LINE_HEIGHT = FONT_SIZE + 1;
export const PAD = 1; // inside the backplate
const GROUP_RADIUS = 5; // elements closer than this share a label
const HOVER_RADIUS = 12; // the crosshair this close opens a group
const COLLAPSED_LINES = 3; // a group shows this many lines, the last one "+N more"
const OPEN_LINES = 24; // an open group shows at most this many
const OFFSET = 3; // from the point to the label
const GAP = 1; // kept between two labels
const SHIFTS = 3; // how many label heights a label may move further up or down

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function groups(items) {
  const out = [];
  for (const it of items) {
    const g = out.find((gr) => dist(gr.at, it) <= GROUP_RADIUS);
    if (g) { if (!g.texts.includes(it.text)) g.texts.push(it.text); } else out.push({ at: { x: it.x, y: it.y }, texts: [it.text] });
  }
  return out;
}

function linesOf(texts, open) {
  const max = open ? OPEN_LINES : COLLAPSED_LINES;
  if (texts.length <= max) return texts;
  return [...texts.slice(0, max - 1), `+${texts.length - (max - 1)} more`];
}

const overlaps = (a, b) => a.x < b.x + b.w + GAP && b.x < a.x + a.w + GAP && a.y < b.y + b.h + GAP && b.y < a.y + a.h + GAP;
const inside = (r, bounds) => r.x >= 0 && r.y >= 0 && r.x + r.w <= bounds.w && r.y + r.h <= bounds.h;

// Spots to try, as the box's top-left relative to the point: beside it first, then
// further up or down on either side.
function spots(w, h) {
  const right = OFFSET, left = -OFFSET - w, above = -OFFSET - h, below = OFFSET;
  const out = [[right, above], [right, below], [left, above], [left, below]];
  for (let k = 1; k <= SHIFTS; k++) {
    const step = k * (h + GAP);
    out.push([right, above - step], [right, below + step], [left, above - step], [left, below + step]);
  }
  return out;
}

// items: [{ x, y, text }] in screen units. cursor: the crosshair, or null. bounds: the
// screen { w, h }. Returns the labels to draw, the open one last (on top):
// [{ x, y, w, h, lines, at, open }], and how many had to be hidden.
export function layoutLabels(items, { cursor = null, bounds }) {
  const near = (g) => (cursor ? dist(g.at, cursor) : 0);
  const gs = groups(items).map((g) => ({ ...g, open: !!cursor && dist(g.at, cursor) <= HOVER_RADIUS }));
  // The open group first, so it always gets its best spot; then nearest the crosshair.
  gs.sort((a, b) => b.open - a.open || near(a) - near(b) || b.texts.length - a.texts.length);
  const placed = [];
  let hidden = 0;
  for (const g of gs) {
    const lines = linesOf(g.texts, g.open);
    const w = Math.max(...lines.map((l) => l.length)) * CHAR_WIDTH + 2 * PAD;
    const h = lines.length * LINE_HEIGHT + 2 * PAD;
    const boxes = spots(w, h).map(([dx, dy]) => ({ x: g.at.x + dx, y: g.at.y + dy, w, h }));
    const free = boxes.find((b) => inside(b, bounds) && !placed.some((p) => overlaps(b, p)))
      || boxes.find((b) => !placed.some((p) => overlaps(b, p)))
      || (g.open ? boxes[0] : null); // the open one is drawn even over others
    if (free) placed.push({ ...free, lines, at: g.at, open: g.open });
    else hidden++;
  }
  return { labels: placed.sort((a, b) => a.open - b.open), hidden };
}

const LABEL_COLOR = '#ffffffdd';
const LABEL_PLATE = '#000000aa'; // behind the text, so it reads over the level
const LABEL_OPEN_PLATE = '#0E2236ee'; // the group under the crosshair
const LABEL_LEADER = '#ffffff55'; // from a moved label back to its point
const LABEL_FONT = `${FONT_SIZE}px DejaVuSansMono`; // in game units, so it stays tiny at any zoom
const MOVED = PAD * 4; // a label further than this from its point gets a leader line

// Lays out and draws labels for items [{ x, y, text }] in screen units. cursor: the
// crosshair in screen units, or null. Returns { shown, hidden }.
export function drawLabels(ctx, items, cursor, bounds) {
  const { labels, hidden } = layoutLabels(items, { cursor, bounds });
  ctx.font = LABEL_FONT;
  ctx.textBaseline = 'top';
  for (const l of labels) {
    const moved = l.x > l.at.x + MOVED || l.x + l.w < l.at.x - MOVED || l.y > l.at.y + MOVED || l.y + l.h < l.at.y - MOVED;
    if (moved) {
      ctx.strokeStyle = LABEL_LEADER;
      ctx.beginPath();
      ctx.moveTo(l.at.x, l.at.y);
      ctx.lineTo(Math.min(Math.max(l.at.x, l.x), l.x + l.w), Math.min(Math.max(l.at.y, l.y), l.y + l.h));
      ctx.stroke();
    }
    ctx.fillStyle = l.open ? LABEL_OPEN_PLATE : LABEL_PLATE;
    ctx.fillRect(l.x, l.y, l.w, l.h);
    ctx.fillStyle = LABEL_COLOR;
    l.lines.forEach((text, i) => ctx.fillText(text, l.x + PAD, l.y + PAD + i * LINE_HEIGHT));
  }
  return { shown: labels.length, hidden };
}

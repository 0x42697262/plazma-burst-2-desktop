// Every kind of map element the editor shows: its name, its layer colour, and its shape
// in the world. Rectangles (walls, regions, ...) are x, y, w, h. Everything else is a
// point with a box around it, sized like the map editor's selection boxes
// (level_editor/editor_scripts/lib_sources.js); "side": -1 mirrors it.
// The order is the layer list's, roughly the map editor's: things you build with first.

export const SHAPE = Object.freeze({ RECT: 'rect', POINT: 'point' });

const BOX = Object.freeze({
  actor: { x: -15, y: -82, w: 30, h: 82 },
  gun: { x: -25, y: -7, w: 50, h: 14 },
  marker: { x: -16, y: -16, w: 32, h: 32 },
  barrel: { x: -15, y: -20, w: 30, h: 40 },
  vehicle: { x: -21, y: -21, w: 42, h: 42 },
});
const VEHICLE_BOX = Object.freeze({
  veh_jeep: { x: -99, y: -32, w: 222, h: 111 },
  veh_walker: { x: -110, y: -56, w: 233, h: 257 },
  veh_capsule: { x: -30, y: -60, w: 60, h: 120 },
  veh_crate: { x: -30, y: -30, w: 60, h: 60 },
  veh_drone: { x: -13, y: -11, w: 45, h: 34 },
  veh_rope: { x: -10, y: 0, w: 20, h: 188 },
  veh_corvette: { x: -49, y: -46, w: 182, h: 129 },
});

const rect = (title, color) => ({ title, color, shape: SHAPE.RECT });
const point = (title, color, box) => ({ title, color, shape: SHAPE.POINT, box });

export const KINDS = Object.freeze({
  box: rect('wall', '#cfd8e3'),
  door: rect('movable', '#ffb347'),
  region: rect('region', '#3C9DFF'),
  bg: rect('background', '#7a8a99'),
  water: rect('water', '#33c3ff'),
  pushf: rect('pusher', '#c77dff'),
  player: point('player', '#ff6666', BOX.actor),
  enemy: point('enemy', '#ff3355', BOX.actor),
  vehicle: point('vehicle', '#e0c341', (attrs) => VEHICLE_BOX[attrs.model] || BOX.vehicle),
  barrel: point('barrel', '#ff7b39', BOX.barrel),
  gun: point('gun', '#9cff6b', BOX.gun),
  decor: point('decoration', '#b3e5c5', BOX.marker),
  lamp: point('lamp', '#fff27a', BOX.marker),
  trigger: point('trigger', '#33ff33', BOX.marker),
  timer: point('timer', '#ffd84d', BOX.marker),
  song: point('song', '#ff9ad5', BOX.marker),
  inf: point('engine mark', '#ffffff', BOX.marker),
  // A custom image's size, for the backgrounds and decorations that use it: no place in
  // the map, shown with the others an old map leaves unplaced; not added by hand.
  image: point('image info', '#a0a0ff', BOX.marker),
});

export const KIND_TAGS = Object.freeze(Object.keys(KINDS));
export const kindOf = (tag) => KINDS[tag] || null;

const num = (v) => (v === undefined || v === '' ? NaN : Number(v));

// Where the map puts an element: { x, y, w, h } with w and h never negative, or null
// for an element with no place (an <image>, an unknown tag, a broken number).
export function boundsOf(e) {
  const kind = kindOf(e.tag);
  if (!kind) return null;
  const { x, y } = anchorOf(e);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (kind.shape === SHAPE.RECT) {
    const w = num(e.attrs.w);
    const h = num(e.attrs.h);
    if (!Number.isFinite(w) || !Number.isFinite(h)) return null;
    return { x: Math.min(x, x + w), y: Math.min(y, y + h), w: Math.abs(w), h: Math.abs(h) };
  }
  const box = typeof kind.box === 'function' ? kind.box(e.attrs) : kind.box;
  const left = num(e.attrs.side) === -1 ? -box.x - box.w : box.x;
  return { x: x + left, y: y + box.y, w: box.w, h: box.h };
}

// Its anchor: the corner the map stores for a rectangle, the point itself otherwise. An
// element an old map gives no place has the spot the document picked for it (doc.js).
export const anchorOf = (e) => (e.attrs.x === undefined && e.spot ? { ...e.spot } : { x: num(e.attrs.x), y: num(e.attrs.y) });

// How an element is called in lists: its uid, or the kind and index for the many walls
// and backgrounds without one.
export const nameOf = (doc, e) => e.attrs.uid || `${kindOf(e.tag)?.title || e.tag} #${doc.ordinal(e)}`;

// What a new element starts with, after its place: the map editor's defaults for each
// kind (level_editor/editor_scripts/lib_classes.js), so the game reads it like one the
// map editor made. Rectangles also get w and h; uid comes from newUid.
export const DEFAULTS = Object.freeze({
  box: { m: '0' },
  door: { moving: 'false', tarx: '0', tary: '0', maxspeed: '10', vis: 'true', attach: '-1' },
  region: { use_target: '-1', use_on: '0', attach: '-1' },
  bg: { m: '0', c: '', a: '-1', u: '0', v: '0', f: '0', s: 'true' },
  water: { damage: '0', friction: 'true' },
  pushf: { tox: '0', toy: '0', stab: '0', damage: '0', attach: '-1' },
  player: { tox: '0', toy: '0', hea: '130', hmax: '130', team: '0', side: '1', char: '1', incar: '-1', botaction: '0', ondeath: '-1' },
  enemy: { tox: '0', toy: '0', hea: '130', hmax: '130', team: '0', side: '1', char: '1', incar: '-1', botaction: '0', ondeath: '-1' },
  vehicle: { side: '1', model: 'veh_jeep', tox: '0', toy: '0', hpp: '100' },
  barrel: { model: 'bar_orange', tox: '0', toy: '0' },
  gun: { model: 'gun_rifle', command: '-1', upg: '0' },
  decor: { model: 'stone', attach: '-1', u: '0', v: '0', f: '0', r: '0', sx: '1', sy: '1' },
  lamp: { power: '0.4', flare: '1' },
  trigger: { enabled: 'true', maxcalls: '1' },
  timer: { enabled: 'true', maxcalls: '1', target: '-1', delay: '30' },
  song: { url: '', volume: '1', loop: 'true', callback: '-1' },
  inf: { mark: 'hero1_guns', forteam: '0' },
  image: { id: '0', width: '100', height: '100' },
});
// Kinds whose elements have no uid in the map editor either.
export const NO_UID = new Set(['box', 'bg', 'inf', 'image']);
// Kinds the map editor only shows: made by uploading a custom image, not placed.
export const NOT_PLACED = new Set(['image']);

// A uid no element has yet, numbered like the map editor's: "#region*12".
export function newUid(doc, tag) {
  if (NO_UID.has(tag)) return undefined;
  const prefix = `#${tag}*`;
  let n = 0;
  for (const e of doc.elements) {
    const uid = e.attrs.uid;
    if (uid && uid.startsWith(prefix)) n = Math.max(n, parseInt(uid.slice(prefix.length), 10) || 0);
  }
  return prefix + (n + 1);
}

// How a parameter names element e: its uid, or in old maps without uids its number (a
// character's among players and enemies together, as the game counts them).
export function referenceTo(doc, e) {
  if (e.attrs.uid) return e.attrs.uid;
  if (e.tag === 'player' || e.tag === 'enemy') {
    return String(doc.elements.filter((x) => x.tag === 'player' || x.tag === 'enemy').indexOf(e));
  }
  return String(doc.ordinal(e));
}

// Map guns in the running level. The game keeps every gun in one list (the ones lying
// on the map and the ones characters carry), so which game gun a map element is, is
// found when it is first edited: a gun no one holds, of the element's model, nearest
// to where the map put it (it may have fallen since), remembered until the level starts
// over. Moving one moves its two physics points, the way "drop" does; a new model,
// upgrade or team is a new gun from the game's gun factory where the old one lies, the
// old one sent out of play.
import { game } from '../../../../src/console/kernel/game/bindings.ts';
import { GAME_FIELDS } from '../../../../src/console/kernel/game/fields.ts';

const FAR = 1e7;
const SEARCH = 400; // world units from the map's place that a fallen gun may be

let found = new Map(); // element id -> game gun

export function forgetGuns() { found = new Map(); }

// The game gun for element e, or null.
export function gunOf(e) {
  if (found.has(e.id)) return found.get(e.id);
  const claimed = new Set(found.values());
  // As it is now, and as the level loaded it (after a restart the game made it from the map).
  const forms = [e.attrs, e.live?.loaded].filter(Boolean);
  let best = null;
  for (const g of game.guns() || []) {
    if (!g || claimed.has(g) || (g.picken_by !== undefined && g.picken_by >= 0)) continue;
    for (const f of forms) {
      if (g.model !== f.model) continue;
      const d = Math.hypot(g.x - Number(f.x), g.y - Number(f.y));
      if (d <= SEARCH && (!best || d < best.d)) best = { g, d };
    }
  }
  if (best) found.set(e.id, best.g);
  return best ? best.g : null;
}

// Puts a gun's physics points (and the gun) at x, y.
function placeGun(g, x, y) {
  const a = g[GAME_FIELDS.G_PT_A], b = g[GAME_FIELDS.G_PT_B];
  const X = game.ptX(), Y = game.ptY(), PX = game.ptPrevX(), PY = game.ptPrevY();
  const dx = x - g.x, dy = y - g.y;
  for (const p of [a, b]) {
    if (!(p >= 0)) continue;
    X[p] += dx; Y[p] += dy;
    if (PX && PY) { PX[p] += dx; PY[p] += dy; }
    game.clearPtInterp(p);
    game.wakePt(p);
  }
  g.x = x; g.y = y;
}

export function moveGun(e) {
  const g = gunOf(e);
  if (!g) throw new Error('its gun is not on the map any more (picked up, or not found)');
  placeGun(g, Number(e.attrs.x), Number(e.attrs.y));
  return true;
}

// A new gun for the element's model, upgrade and team where the old one lies.
export function remakeGun(e) {
  const old = gunOf(e);
  if (!old) throw new Error('its gun is not on the map any more (picked up, or not found)');
  // Where the old one lies, or where the map puts it if the old one was taken out.
  const away = old.x >= FAR;
  const at = away ? { x: Number(e.attrs.x), y: Number(e.attrs.y) } : { x: old.x, y: old.y };
  const g = game.spawnGun(e.attrs.model, { ...at, upg: parseInt(e.attrs.upg, 10) || 0, command: parseInt(e.attrs.command, 10) });
  if (!g) throw new Error(`the game has no gun "${e.attrs.model}"`);
  if (!away) { placeGun(old, FAR, FAR); old.visible = false; }
  found.set(e.id, g);
  return true;
}

// Sends element e's gun out of play (a deleted map gun).
export function removeGun(e) {
  const g = gunOf(e);
  if (!g) throw new Error('its gun is not on the map any more (picked up, or not found)');
  placeGun(g, FAR, FAR);
  g.visible = false;
}

// A gun just made for element e by the loader: the newest one in the game's list.
export function claimNewestGun(e) {
  const guns = game.guns() || [];
  for (let k = guns.length - 1; k >= 0; k--) if (guns[k]) { found.set(e.id, guns[k]); return; }
}

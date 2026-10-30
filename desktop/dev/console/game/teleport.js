// Moving your character somewhere: the same steps as the game's own "move character to
// region" trigger. Every physics point of the player and of the guns they carry is
// shifted, the camera follows, and the teleport effect plays where they left and where
// they arrive. Used by "tp" and by the editor (back to your spot after a reload).
import { game } from './bindings.js';
import { F } from './fields.js';
import { player, BODY_MIDDLE } from './level.js';

export function movePlayerTo(tx, ty, { effect = true } = {}) {
  const p = player();
  const X = game.ptX(), Y = game.ptY();
  const ref = p[F.REF_PT];
  const u = X[ref] - tx;
  const v = Y[ref] - ty;
  if (!Number.isFinite(u) || !Number.isFinite(v)) throw new Error('could not read your position');
  if (game.cameraFollowsMe()) game.moveCamera(u, v);
  const me = p[F.INDEX];
  const owner = game.ptOwner();
  const guns = game.guns();
  const base = game.gunPtBase(), range = game.gunPtRange();
  const interp = game.interpolating();
  const PX = game.ptPrevX(), PY = game.ptPrevY();
  for (let i = 0, n = game.ptCount(); i < n; i++) {
    const o = owner[i];
    const mine = o === me || (o >= base && o < base + range && guns[o - base] && guns[o - base].picken_by === me);
    if (!mine) continue;
    X[i] -= u;
    Y[i] -= v;
    if (interp) { PX[i] -= u; PY[i] -= v; }
    game.clearPtInterp(i);
  }
  if (effect) try { game.teleportFx(p.x, p.y - BODY_MIDDLE); } catch {}
  p.x -= u;
  p.y -= v;
  if (effect) try { game.teleportFx(p.x, p.y - BODY_MIDDLE); } catch {}
  p[F.AFTER_MOVE]();
}

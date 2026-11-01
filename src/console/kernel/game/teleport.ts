import { TEXT } from './text.ts';
import { GAME_FIELDS } from './fields.ts';
import { PICKED_BY } from './keys.ts';
import { game } from './bindings.ts';
import { player, BODY_MIDDLE } from './level.ts';

function playEffect(atX: number, atY: number): void {
  try {
    game.teleportFx(atX, atY - BODY_MIDDLE);
  } catch {
    return;
  }
}

export function movePlayerTo(targetX: number, targetY: number, { effect = true }: { effect?: boolean } = {}): void {
  const current = player();
  if (!current) throw new Error(TEXT.noPosition);
  const pointsX = game.ptX();
  const pointsY = game.ptY();
  const reference = current[GAME_FIELDS.REF_PT] as number;
  const shiftX = (pointsX[reference] ?? Number.NaN) - targetX;
  const shiftY = (pointsY[reference] ?? Number.NaN) - targetY;
  if (!Number.isFinite(shiftX) || !Number.isFinite(shiftY)) throw new Error(TEXT.noPosition);
  if (game.cameraFollowsMe()) game.moveCamera(shiftX, shiftY);
  const me = current[GAME_FIELDS.INDEX];
  const owners = game.ptOwner();
  const guns = game.guns();
  const gunBase = game.gunPtBase();
  const gunRange = game.gunPtRange();
  const interpolating = game.interpolating();
  const previousX = game.ptPrevX();
  const previousY = game.ptPrevY();
  for (let point = 0, count = game.ptCount(); point < count; point++) {
    const owner = owners[point] ?? -1;
    const isGunPoint = owner >= gunBase && owner < gunBase + gunRange;
    const isMine = owner === me || (isGunPoint && guns[owner - gunBase]?.[PICKED_BY] === me);
    if (!isMine) continue;
    pointsX[point] = (pointsX[point] ?? 0) - shiftX;
    pointsY[point] = (pointsY[point] ?? 0) - shiftY;
    if (interpolating) {
      previousX[point] = (previousX[point] ?? 0) - shiftX;
      previousY[point] = (previousY[point] ?? 0) - shiftY;
    }
    game.clearPtInterp(point);
  }
  if (effect) playEffect(current.x, current.y);
  current.x -= shiftX;
  current.y -= shiftY;
  if (effect) playEffect(current.x, current.y);
  (current[GAME_FIELDS.AFTER_MOVE] as () => void).call(current);
}

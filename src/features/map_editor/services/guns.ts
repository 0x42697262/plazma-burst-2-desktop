import { game } from '#console/kernel/game/bindings.ts';
import { GAME_FIELDS } from '#console/kernel/game/fields.ts';
import { DECIMAL_RADIX } from '../domain/constants.ts';
import type { Attrs, MapElement } from '../domain/doc.ts';
import { FAR, GUN_SEARCH } from './constants.ts';
import { SERVICES_TEXT as TEXT } from './text.ts';

type GameGun = { x: number; y: number; model?: unknown; picken_by?: number; visible?: boolean; [field: string]: unknown };

let found = new Map<number, GameGun>();

export function forgetGuns(): void {
  found = new Map();
}

export function gunOf(item: MapElement): GameGun | null {
  const known = found.get(item.id);
  if (found.has(item.id)) return known ?? null;
  const claimed = new Set(found.values());
  const forms = [item.attrs, item.live?.loaded].filter((form): form is Attrs => !!form);
  let best: { gun: GameGun; distance: number } | null = null;
  for (const gun of (game.guns() || []) as (GameGun | null | undefined)[]) {
    if (!gun || claimed.has(gun) || (gun.picken_by !== undefined && gun.picken_by >= 0)) continue;
    for (const form of forms) {
      if (gun.model !== form.model) continue;
      const distance = Math.hypot(gun.x - Number(form.x), gun.y - Number(form.y));
      if (distance <= GUN_SEARCH && (!best || distance < best.distance)) best = { gun, distance };
    }
  }
  if (best) found.set(item.id, best.gun);
  return best ? best.gun : null;
}

function placeGun(gun: GameGun, atX: number, atY: number): void {
  const pointA = gun[GAME_FIELDS.G_PT_A] as number;
  const pointB = gun[GAME_FIELDS.G_PT_B] as number;
  const pointsX = game.ptX();
  const pointsY = game.ptY();
  const previousX = game.ptPrevX();
  const previousY = game.ptPrevY();
  const shiftX = atX - gun.x;
  const shiftY = atY - gun.y;
  for (const point of [pointA, pointB]) {
    if (!(point >= 0)) continue;
    pointsX[point] = (pointsX[point] as number) + shiftX;
    pointsY[point] = (pointsY[point] as number) + shiftY;
    if (previousX && previousY) {
      previousX[point] = (previousX[point] as number) + shiftX;
      previousY[point] = (previousY[point] as number) + shiftY;
    }
    game.clearPtInterp(point);
    game.wakePt(point);
  }
  gun.x = atX;
  gun.y = atY;
}

export function moveGun(item: MapElement): boolean {
  const gun = gunOf(item);
  if (!gun) throw new Error(TEXT.gunGone);
  placeGun(gun, Number(item.attrs.x), Number(item.attrs.y));
  return true;
}

export function remakeGun(item: MapElement): boolean {
  const old = gunOf(item);
  if (!old) throw new Error(TEXT.gunGone);
  const away = old.x >= FAR;
  const at = away ? { x: Number(item.attrs.x), y: Number(item.attrs.y) } : { x: old.x, y: old.y };
  const gun = game.spawnGun(item.attrs.model, {
    ...at, upg: parseInt(item.attrs.upg ?? '', DECIMAL_RADIX) || 0, command: parseInt(item.attrs.command ?? '', DECIMAL_RADIX),
  }) as GameGun | null | undefined;
  if (!gun) throw new Error(TEXT.noSuchGun(item.attrs.model));
  if (!away) {
    placeGun(old, FAR, FAR);
    old.visible = false;
  }
  found.set(item.id, gun);
  return true;
}

export function removeGun(item: MapElement): void {
  const gun = gunOf(item);
  if (!gun) throw new Error(TEXT.gunGone);
  placeGun(gun, FAR, FAR);
  gun.visible = false;
}

export function claimNewestGun(item: MapElement): void {
  const guns = (game.guns() || []) as (GameGun | null | undefined)[];
  for (let at = guns.length - 1; at >= 0; at--) {
    const gun = guns[at];
    if (gun) {
      found.set(item.id, gun);
      return;
    }
  }
}

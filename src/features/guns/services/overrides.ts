import type { FrameOverride, OverrideContext } from '#console/feature-types.ts';
import { game } from '#console/kernel/game/bindings.ts';
import { GAME_FIELDS } from '#console/kernel/game/fields.ts';
import { KEY } from '#console/kernel/state/schema.ts';
import { settings } from '#console/kernel/state/store.ts';
import { force, original, restore, restoreObj } from '#console/kernel/overrides/force.ts';
import { NO_WEAPON } from '../constants.ts';
import { OVERRIDE_NAME } from '../keys.ts';

type Bullet = Record<string, unknown> & { spx: number; spy: number };

const seenBullets = new WeakSet<object>();
const forcedGuns = new Set<object>();

const isSet = (key: string): boolean => settings.has(key);
const valueOf = (key: string): unknown => settings.get(key);
const numberOf = (key: string): number => valueOf(key) as number;

function forceMultiplied(target: Record<string, unknown>, field: string, key: string): void {
  if (isSet(key)) force(target, field, (original(target, field) as number) * numberOf(key));
  else restore(target, field);
}

function applyGun({ character }: OverrideContext): void {
  const guns = game.guns();
  const held = character.curwea >= NO_WEAPON && guns ? guns[character.curwea] ?? null : null;
  for (const gun of [...forcedGuns]) {
    if (gun !== held) {
      restoreObj(gun);
      forcedGuns.delete(gun);
    }
  }
  if (!held || typeof held !== 'object') return;
  forcedGuns.add(held);
  forceMultiplied(held, GAME_FIELDS.G_RATE, KEY.FIRE_RATE);
  if (isSet(KEY.PELLETS)) force(held, GAME_FIELDS.G_PELLETS, valueOf(KEY.PELLETS));
  else restore(held, GAME_FIELDS.G_PELLETS);
  forceMultiplied(held, GAME_FIELDS.G_SPREAD, KEY.SPREAD);
  if (isSet(KEY.SPREAD) && valueOf(KEY.SPREAD) === 0) held[GAME_FIELDS.G_BLOOM] = 0;
  forceMultiplied(held, GAME_FIELDS.G_RECOIL, KEY.RECOIL);
}

function keepPenetration(bullet: Bullet, keep: number): void {
  let damage = bullet[GAME_FIELDS.B_DMG];
  Object.defineProperty(bullet, GAME_FIELDS.B_DMG, {
    configurable: true,
    enumerable: true,
    get: () => damage,
    set: (next: unknown) => {
      const isLoss = typeof next === 'number' && typeof damage === 'number' && next < damage;
      damage = isLoss ? damage as number - (damage as number - next) * (1 - keep) : next;
    },
  });
}

function applyBullets(): void {
  const bullets = game.bullets() as (Bullet | null | undefined)[] | null;
  const me = game.me();
  if (!bullets) return;
  for (const bullet of bullets) {
    if (!bullet || typeof bullet !== 'object' || seenBullets.has(bullet)) continue;
    seenBullets.add(bullet);
    if (bullet[GAME_FIELDS.B_OWNER] !== me) continue;
    if (isSet(KEY.BULLET_DAMAGE)) bullet[GAME_FIELDS.B_DMG] = (bullet[GAME_FIELDS.B_DMG] as number) * numberOf(KEY.BULLET_DAMAGE);
    if (isSet(KEY.BULLET_SPEED)) {
      bullet.spx *= numberOf(KEY.BULLET_SPEED);
      bullet.spy *= numberOf(KEY.BULLET_SPEED);
    }
    if (isSet(KEY.BULLET_LIFE)) bullet[GAME_FIELDS.B_LIFE] = (bullet[GAME_FIELDS.B_LIFE] as number) * numberOf(KEY.BULLET_LIFE);
    if (isSet(KEY.PENETRATION) && numberOf(KEY.PENETRATION) > 0) keepPenetration(bullet, numberOf(KEY.PENETRATION));
  }
}

function apply(context: OverrideContext): void {
  applyGun(context);
  applyBullets();
}

export const gunsOverride: FrameOverride = Object.freeze({ name: OVERRIDE_NAME, apply, cleanup: () => { forcedGuns.clear(); } });

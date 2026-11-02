import type { FrameOverride } from '#console/feature-types.ts';
import { game } from '#console/kernel/game/bindings.ts';
import { GAME_FIELDS } from '#console/kernel/game/fields.ts';
import { SETTING } from '#features/guns/keys.ts';
import { settings } from '#console/kernel/state/store.ts';
import { OVERRIDE_NAME } from '../../keys.ts';
import { CAPABILITY } from '#shared/features/keys.ts';

type Bullet = Record<string, unknown> & { spx: number; spy: number };

const seenBullets = new WeakSet<object>();

const isSet = (key: string): boolean => settings.has(key);
const valueOf = (key: string): unknown => settings.get(key);
const numberOf = (key: string): number => valueOf(key) as number;

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

function apply(): void {
  const bullets = game.bullets() as (Bullet | null | undefined)[] | null;
  const me = game.me();
  if (!bullets) return;
  for (const bullet of bullets) {
    if (!bullet || typeof bullet !== 'object' || seenBullets.has(bullet)) continue;
    seenBullets.add(bullet);
    if (bullet[GAME_FIELDS.B_OWNER] !== me) continue;
    if (isSet(SETTING.bulletDamage)) bullet[GAME_FIELDS.B_DMG] = (bullet[GAME_FIELDS.B_DMG] as number) * numberOf(SETTING.bulletDamage);
    if (isSet(SETTING.bulletSpeed)) {
      bullet.spx *= numberOf(SETTING.bulletSpeed);
      bullet.spy *= numberOf(SETTING.bulletSpeed);
    }
    if (isSet(SETTING.bulletLife)) bullet[GAME_FIELDS.B_LIFE] = (bullet[GAME_FIELDS.B_LIFE] as number) * numberOf(SETTING.bulletLife);
    if (isSet(SETTING.penetration) && numberOf(SETTING.penetration) > 0) keepPenetration(bullet, numberOf(SETTING.penetration));
  }
}

const nothingToUndo = (): void => undefined;

export const bulletsOverride: FrameOverride = Object.freeze({ name: OVERRIDE_NAME.bullets, capability: CAPABILITY.guns.bullets, apply, cleanup: nothingToUndo });

// God mode: replace a character's HP with an accessor that ignores decreases. Bullets are
// processed before the death check in the same tick, so refilling HP each frame is too late.
import { GAME_FIELDS } from '../../../../src/console/kernel/game/fields.ts';

const godObjs = new Set();

export function installGod(p, isOn) {
  if (godObjs.has(p)) return;
  let v = p[GAME_FIELDS.HP];
  Object.defineProperty(p, GAME_FIELDS.HP, {
    configurable: true,
    enumerable: true,
    get() { return v; },
    set(n) {
      if (isOn() && typeof n === 'number' && n < v) return;
      v = n;
    },
  });
  godObjs.add(p);
}

export function uninstallGod(p) {
  if (!godObjs.has(p)) return;
  const v = p[GAME_FIELDS.HP];
  delete p[GAME_FIELDS.HP];
  p[GAME_FIELDS.HP] = v;
  godObjs.delete(p);
}

// Takes god away from everything except `keep`.
export const uninstallGodExcept = (keep) => { for (const o of [...godObjs]) if (o !== keep) uninstallGod(o); };
export const uninstallAllGod = () => uninstallGodExcept(null);

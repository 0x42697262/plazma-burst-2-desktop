import { GAME_FIELDS } from '../game/fields.ts';

const godCharacters = new Set<object>();

export function installGod(character: object, isOn: () => boolean): void {
  if (godCharacters.has(character)) return;
  let health = (character as Record<string, unknown>)[GAME_FIELDS.HP];
  Object.defineProperty(character, GAME_FIELDS.HP, {
    configurable: true,
    enumerable: true,
    get: () => health,
    set: (next: unknown) => {
      const isDamage = typeof next === 'number' && typeof health === 'number' && next < health;
      if (isOn() && isDamage) return;
      health = next;
    },
  });
  godCharacters.add(character);
}

export function uninstallGod(character: object): void {
  if (!godCharacters.has(character)) return;
  const fields = character as Record<string, unknown>;
  const health = fields[GAME_FIELDS.HP];
  Reflect.deleteProperty(fields, GAME_FIELDS.HP);
  fields[GAME_FIELDS.HP] = health;
  godCharacters.delete(character);
}

export const uninstallGodExcept = (keep: object | null): void => {
  for (const character of [...godCharacters]) if (character !== keep) uninstallGod(character);
};
export const uninstallAllGod = (): void => { uninstallGodExcept(null); };

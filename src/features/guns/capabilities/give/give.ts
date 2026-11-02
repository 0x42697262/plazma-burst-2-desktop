import { NO_COMMAND } from '../../constants.ts';
import type { Gun } from '../../domain/catalog.ts';
import { gunBindings as game, gunFields as fields, slots, type Target } from '../../adapters/game-guns.ts';
import { TEXT } from './text.ts';

export type GiveResult = { text: string; isPartial: boolean };

const isCarrySlot = (slot: number): boolean => slot >= 0 && slot <= slots.last;

export function giveGun(gun: Gun, upgrade: number, { p: character, i: index, who }: Target): GiveResult {
  const isAlive = (character[fields.HP] as number) > 0 && !character[fields.DEAD];
  if (!isAlive) throw new Error(TEXT.dead(who));
  const spawned = game.spawnGun(gun.model, { x: character.x, y: character.y, upg: upgrade, command: NO_COMMAND });
  if (!spawned) throw new Error(TEXT.notCreated(gun.model));
  const slot = spawned[fields.G_SLOT] as number;
  const gunIndex = spawned[fields.INDEX] as number;
  if (spawned[fields.G_FIXED] || !isCarrySlot(slot)) return { text: TEXT.spawned(gun.name, who), isPartial: false };
  character[slots.field(slot)] = gunIndex;
  if (character[slots.field(slot)] !== gunIndex) return { text: TEXT.slotNotAssigned(gun.name, who, slot), isPartial: true };
  character.curwea = gunIndex;
  game.refreshChar(index);
  return { text: TEXT.gave(who, gun.name, gun.model, slot, upgrade), isPartial: false };
}

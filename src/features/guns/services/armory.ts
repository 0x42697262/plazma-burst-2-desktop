import { NO_COMMAND, TOSS } from '../constants.ts';
import { GRENADE_CLASS_PREFIX, ITEM_PREFIX_AT_START } from '../keys.ts';
import { TEXT } from '../text.ts';
import { kindOf, type Gun } from '../domain/catalog.ts';
import { gunBindings as game, gunFields as fields, slots, type GameCharacter, type GameGun, type Target } from '../adapters/game-guns.ts';

export type GiveResult = { text: string; isPartial: boolean };

let catalog: Gun[] | null = null;

function slotOfModel(model: string): number | null {
  const scripts = game.gunScripts();
  const grenadeClass = GRENADE_CLASS_PREFIX + model.replace(ITEM_PREFIX_AT_START, '');
  const gunClass = scripts[model] ? model : scripts[grenadeClass] ? grenadeClass : null;
  return gunClass ? game.gunSlotOf(gunClass) : null;
}

function nameOf(model: string): string {
  try {
    return game.gunName(model) || model;
  } catch {
    return model;
  }
}

export function gunList(): Gun[] {
  if (catalog) return catalog;
  const models = game.gunModels();
  if (!models.length) models.push(...Object.keys(game.gunScripts()));
  catalog = models.map((model) => ({ model, name: nameOf(model), kind: kindOf(model), slot: slotOfModel(model) }));
  return catalog;
}

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

export function dropGun(character: GameCharacter, slot: number): GameGun | null {
  const gunIndex = character[slots.field(slot)] as number;
  if (!(gunIndex >= 0)) return null;
  const gun = game.guns()[gunIndex];
  character[slots.field(slot)] = slots.empty;
  if (character[slots.field(slot)] !== slots.empty) throw new Error(TEXT.slotNotEmptied(slot));
  if (character.curwea === gunIndex) character.curwea = slots.empty;
  if (!gun) return null;
  const pointA = gun[fields.G_PT_A] as number;
  const pointB = gun[fields.G_PT_B] as number;
  const velocityX = game.ptVelX();
  const velocityY = game.ptVelY();
  const positionX = game.ptX();
  const angle = (character[fields.AIM] as number) || 0;
  const facing = (character[fields.FACING] as number) || 0;
  velocityX[pointA] = (velocityX[pointA] ?? 0) + Math.sin(angle) * TOSS.speedA;
  velocityY[pointA] = (velocityY[pointA] ?? 0) + Math.cos(angle) * TOSS.speedA - TOSS.liftA;
  velocityX[pointB] = (velocityX[pointB] ?? 0) + Math.sin(angle) * TOSS.speedB;
  velocityY[pointB] = (velocityY[pointB] ?? 0) + Math.cos(angle) * TOSS.speedB + TOSS.sinkB;
  positionX[pointA] = (positionX[pointA] ?? 0) + facing * TOSS.ahead;
  positionX[pointB] = (positionX[pointB] ?? 0) + facing * TOSS.ahead;
  game.wakePt(pointA);
  game.wakePt(pointB);
  return gun;
}

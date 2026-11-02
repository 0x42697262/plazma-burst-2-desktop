import { TOSS } from '../../constants.ts';
import { gunBindings as game, gunFields as fields, slots, type GameCharacter, type GameGun } from '../../adapters/game-guns.ts';
import { TEXT } from './text.ts';

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

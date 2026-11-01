import type { FrameOverride, OverrideContext } from '#console/feature-types.ts';
import { game } from '#console/kernel/game/bindings.ts';
import { GAME_FIELDS } from '#console/kernel/game/fields.ts';
import type { MovingCharacter } from '#console/kernel/game/types.ts';
import { KEY } from '#console/kernel/state/schema.ts';
import { settings } from '#console/kernel/state/store.ts';
import { force, restore } from '#console/kernel/overrides/force.ts';
import { AIR_TOP_SPEED, AIR_WALK, FLY_DAMPING, STAND_WALK_BASE, STAND_WALK_SCALE, STAND_WALK_SIT_FACTOR } from './constants.ts';
import { OVERRIDE_NAME } from './keys.ts';

let originalGravity: unknown = null;

const isSet = (key: string): boolean => settings.has(key);
const valueOf = (key: string): unknown => settings.get(key);
const standWalk = (sit: number): number => (STAND_WALK_BASE - sit * STAND_WALK_SIT_FACTOR) * STAND_WALK_SCALE;
const healthOf = (character: MovingCharacter): number => character[GAME_FIELDS.HP];

function applySpeed(character: MovingCharacter, running: boolean, tick: number): void {
  if (!isSet(KEY.SPEED) || !running || !(healthOf(character) > 0)) return;
  const speed = valueOf(KEY.SPEED) as number;
  const walk = character[GAME_FIELDS.WALK] as number;
  if (!walk) return;
  if (character.stand) character.tox += walk * standWalk(character.sit) * tick * (speed - 1);
  else if (speed > 1 && character.tox * Math.sign(walk) < AIR_TOP_SPEED * speed) character.tox += walk * AIR_WALK * tick * (speed - 1);
}

function applySwords(character: MovingCharacter): void {
  if (isSet(KEY.SWORDS)) {
    const swordsOff = !valueOf(KEY.SWORDS);
    if (character[GAME_FIELDS.NO_SWORDS] !== swordsOff) {
      force(character, GAME_FIELDS.NO_SWORDS, swordsOff);
      game.refreshChar(game.me());
    }
  } else if (restore(character, GAME_FIELDS.NO_SWORDS)) {
    game.refreshChar(game.me());
  }
}

function applyWorld(): void {
  if (isSet(KEY.WORLD_GRAVITY)) {
    if (originalGravity === null) originalGravity = game.getGravity();
    if (game.getGravity() !== valueOf(KEY.WORLD_GRAVITY)) game.setGravity(valueOf(KEY.WORLD_GRAVITY));
  } else if (originalGravity !== null) {
    game.setGravity(originalGravity);
    originalGravity = null;
  }
}

function apply({ character, running, tick }: OverrideContext): void {
  applySpeed(character, running, tick);
  if (isSet(KEY.JUMP)) force(character, GAME_FIELDS.JUMP, valueOf(KEY.JUMP));
  else restore(character, GAME_FIELDS.JUMP);
  const isFlying = valueOf(KEY.FLY) === true;
  const isAlive = healthOf(character) > 0;
  if ((valueOf(KEY.GRAVITY) === false || isFlying) && running && isAlive && !character.stand) {
    character.toy -= (game.getGravity() as number) * tick;
  }
  applySwords(character);
  if (isFlying && running && isAlive) {
    const flySpeed = settings.effective(KEY.FLY_SPEED) as number;
    if (game.keyUp()) character.toy = -flySpeed;
    else if (game.keyDown()) character.toy = flySpeed;
    else character.toy *= FLY_DAMPING;
  }
  applyWorld();
}

function cleanup(): void {
  if (originalGravity === null) return;
  game.setGravity(originalGravity);
  originalGravity = null;
}

export const movementOverride: FrameOverride = Object.freeze({ name: OVERRIDE_NAME, apply, cleanup });

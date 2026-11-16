import type { FrameOverride, OverrideContext } from '#console/feature-types.ts';
import type { MovingCharacter } from '#console/kernel/game/types.ts';
import { CAPABILITY } from '#shared/features/keys.ts';
import { game } from '#console/kernel/game/bindings.ts';
import { GAME_FIELDS } from '#console/kernel/game/fields.ts';
import { FLY_MODE, SETTING } from '#features/movement/keys.ts';
import { settings } from '#console/kernel/state/store.ts';
import { FLY_DAMPING, FRAMES_PER_TICK_AT_60_FPS, FIRST_STAGE_X, FULL_LIFT, OUTSIDE_VIEW_AIM_X, STEADY_STABILITY } from '../../constants.ts';
import { SWEEP_FPS_CHOICE } from '../../keys.ts';
import { aimWatched } from '#console/kernel/overrides/server-checks.ts';
import { sweep } from './sweep.ts';
import { GAME_WIDTH } from '#console/kernel/game/constants.ts';
import { OVERRIDE_NAME } from '../../keys.ts';
import { isAlive } from '../../services/character.ts';

const numberSetting = (key: string): number => settings.effective(key) as number;
const intentOf = (character: MovingCharacter, field: string): number => {
  const intent = character[field];
  return typeof intent === 'number' ? intent : 0;
};

function cancelGravity(character: MovingCharacter, tick: number, share: number): void {
  const isGravityAlreadyOff = settings.get(SETTING.gravity) === false;
  if (!character.stand && !isGravityAlreadyOff) character.toy -= (game.getGravity() as number) * share * tick;
}

function flyVertical(character: MovingCharacter, tick: number): void {
  cancelGravity(character, tick, FULL_LIFT);
  const flySpeed = numberSetting(SETTING.flySpeed);
  if (game.keyUp()) character.toy = -flySpeed;
  else if (game.keyDown()) character.toy = flySpeed;
  else character.toy *= FLY_DAMPING;
}

function flyFree(character: MovingCharacter, tick: number): void {
  cancelGravity(character, tick, numberSetting(SETTING.flyLift));
  character.tox += intentOf(character, GAME_FIELDS.MOVE_INTENT_X) * numberSetting(SETTING.flyAccelX) * tick;
  character.toy += intentOf(character, GAME_FIELDS.MOVE_INTENT_Y) * numberSetting(SETTING.flyAccelY) * tick;
  const kept = numberSetting(SETTING.flyDrag) ** (tick * FRAMES_PER_TICK_AT_60_FPS);
  character.tox *= kept;
  character.toy *= kept;
  if (settings.effective(SETTING.flyUpright) === true) character[GAME_FIELDS.STABILITY] = STEADY_STABILITY;
}

type SweepBindings = { fpsChoice(): unknown; lowPhysics(): unknown; zoom(): number; camera(): { x: number } | null; setMouseX(stageX: number): void };
const sweepGame = game as unknown as SweepBindings;

export const isSweepReady = (): boolean => sweepGame.fpsChoice() === SWEEP_FPS_CHOICE && sweepGame.lowPhysics() !== true;

export const sweepRange = (): number => {
  const range = numberSetting(SETTING.flySweepRange);
  return aimWatched() ? Math.min(range, OUTSIDE_VIEW_AIM_X) : range;
};

function flySweep(character: MovingCharacter): void {
  const camera = sweepGame.camera();
  if (!sweep.active || !camera || !isSweepReady()) return;
  sweep.direction = -sweep.direction;
  const stageX = (character.x + sweep.direction * sweepRange()) * sweepGame.zoom() + camera.x;
  sweepGame.setMouseX(Math.max(FIRST_STAGE_X, Math.min(GAME_WIDTH, stageX)));
}

function apply({ character, running, tick }: OverrideContext): void {
  if (!running || !isAlive(character)) return;
  const mode = settings.get(SETTING.fly);
  if (mode === FLY_MODE.vertical) flyVertical(character, tick);
  else if (mode === FLY_MODE.free) flyFree(character, tick);
  else if (mode === FLY_MODE.sweep) flySweep(character);
}

const nothingToUndo = (): void => undefined;

export const flyOverride: FrameOverride = Object.freeze({ name: OVERRIDE_NAME.fly, capability: CAPABILITY.movement.fly, apply, cleanup: nothingToUndo });

import type { FrameOverride, OverrideContext } from '#console/feature-types.ts';
import type { MovingCharacter } from '#console/kernel/game/types.ts';
import { CAPABILITY } from '#shared/features/keys.ts';
import { game } from '#console/kernel/game/bindings.ts';
import { GAME_FIELDS } from '#console/kernel/game/fields.ts';
import { FLY_MODE, SETTING, SWEEP_AIM, SWEEP_MEASURE, SWEEP_MODES, SWEEP_THROTTLE } from '#features/movement/keys.ts';
import { GAME_HEIGHT, GAME_WIDTH } from '#console/kernel/game/constants.ts';
import { settings } from '#console/kernel/state/store.ts';
import { DIRECTIONAL_DEAD_ZONE, EDGE_DEAD_ZONE, HALF_TURN_RADIANS, FLY_DAMPING, FRAMES_PER_TICK_AT_60_FPS, FULL_LIFT, OUTSIDE_VIEW_AIM_X, STEADY_STABILITY } from '../../constants.ts';
import { SWEEP_FPS_CHOICE } from '../../keys.ts';
import { aimWatched } from '#console/kernel/overrides/server-checks.ts';
import { LEVEL_SWING, cursorSide, holdAim, holdKeys, releaseAim, sweep } from './sweep.ts';
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

type SweepBindings = { fpsChoice(): unknown; lowPhysics(): unknown; zoom(): number; isMouseHeld(): boolean };
const sweepGame = game as unknown as SweepBindings;

export const isDirectional = (): boolean => settings.effective(SETTING.flySweepAim) === SWEEP_AIM.directional;

export const isInverse = (): boolean => {
  const aim = settings.effective(SETTING.flySweepAim);
  return aim === SWEEP_AIM.inverse || aim === true || aim === SWEEP_AIM.directional;
};

function holdsRagdoll(): boolean | null {
  const share = numberSetting(SETTING.flySweepRagdoll);
  if (!(share > 0)) return null;
  sweep.ragdollCarry += Math.min(1, share);
  if (sweep.ragdollCarry < 1) return false;
  sweep.ragdollCarry -= 1;
  return true;
}

const isEdge = (): boolean => settings.effective(SETTING.flySweepThrottle) !== SWEEP_THROTTLE.near;

function shaped(share: number): number {
  const clamped = Math.min(1, Math.abs(share));
  if (clamped <= EDGE_DEAD_ZONE) return 0;
  return ((clamped - EDGE_DEAD_ZONE) / (1 - EDGE_DEAD_ZONE)) ** numberSetting(SETTING.flySweepCurve);
}

function steerByEdge(character: MovingCharacter, cursor: { x: unknown; y: unknown }, isStarting: boolean): number {
  const zoom = Number(sweepGame.zoom()) || 1;
  const isByDistance = settings.effective(SETTING.flySweepMeasure) === SWEEP_MEASURE.distance;
  const reach = numberSetting(SETTING.flySweepReach);
  const towardX = isByDistance ? (Number(cursor.x) - character.x) / reach : ((Number(cursor.x) - character.x) * zoom) / GAME_WIDTH;
  const towardY = isByDistance ? (Number(cursor.y) - character.y) / reach : ((Number(cursor.y) - character.y) * zoom) / GAME_HEIGHT;
  const offsetX = Number(cursor.x) - character.x;
  const offsetY = Number(cursor.y) - character.y;
  const distance = Math.hypot(offsetX, offsetY);
  const isTilted = isDirectional() && distance > 0;
  const axisX = isTilted ? -offsetX / distance : 0;
  const axisY = isTilted ? -offsetY / distance : sweep.upOnly ? 1 : (Math.sign(towardY) || -1) * (sweep.inverse ? -1 : 1);
  const halfSwing = shaped(isTilted || sweep.upOnly ? Math.hypot(towardX, towardY) : towardY) * HALF_TURN_RADIANS;
  sweep.swing = isStarting ? LEVEL_SWING : { axisX, axisY, along: Math.cos(halfSwing), across: Math.sin(halfSwing) };
  sweep.sideCarry += shaped(towardX);
  if (sweep.sideCarry < 1) return 0;
  sweep.sideCarry -= 1;
  return Math.sign(towardX);
}

export const isSweepReady = (): boolean => sweepGame.fpsChoice() === SWEEP_FPS_CHOICE && sweepGame.lowPhysics() !== true;

export const sweepRange = (): number => {
  const range = numberSetting(SETTING.flySweepRange);
  return aimWatched() ? Math.min(range, OUTSIDE_VIEW_AIM_X) : range;
};

function flySweep(character: MovingCharacter, withMouse: boolean): void {
  if (!sweep.active || !isSweepReady()) {
    releaseAim();
    return;
  }
  const isStarting = sweep.held?.character !== character;
  if (isStarting) sweep.direction = -(Math.sign(Number(character.tarx) - character.x) || 1);
  const isShooting = !withMouse && !isStarting && settings.effective(SETTING.flySweepShoot) === true && sweepGame.isMouseHeld();
  sweep.atCursor = isShooting && !sweep.atCursor;
  if (!sweep.atCursor) sweep.direction = -sweep.direction;
  sweep.range = sweepRange();
  sweep.inverse = isInverse();
  sweep.upOnly = settings.effective(SETTING.flySweepAim) === SWEEP_AIM.up;
  holdAim(character);
  const cursor = sweep.held?.gameAim ?? { x: character.x, y: character.y };
  if (isEdge()) {
    const side = steerByEdge(character, cursor, isStarting);
    holdKeys({ ragdoll: holdsRagdoll(), mouse: withMouse, side: isDirectional() ? side : null });
    return;
  }
  sweep.swing = null;
  holdKeys({ ragdoll: holdsRagdoll(), mouse: withMouse, side: isDirectional() ? cursorSide(character, DIRECTIONAL_DEAD_ZONE) : null });
}

function apply({ character, running, tick }: OverrideContext): void {
  if (!running || !isAlive(character)) {
    releaseAim();
    return;
  }
  const mode = settings.get(SETTING.fly);
  if (mode === FLY_MODE.vertical) flyVertical(character, tick);
  else if (mode === FLY_MODE.free) flyFree(character, tick);
  else if (SWEEP_MODES.includes(mode)) flySweep(character, mode === FLY_MODE.sword);
  if (!SWEEP_MODES.includes(mode)) releaseAim();
}

export const flyOverride: FrameOverride = Object.freeze({ name: OVERRIDE_NAME.fly, capability: CAPABILITY.movement.fly, apply, cleanup: releaseAim });

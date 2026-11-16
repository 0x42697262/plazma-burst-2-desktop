import { game } from '#console/kernel/game/bindings.ts';
import { AIM_X_FIELD, AIM_Y_FIELD } from '../../keys.ts';

type AimHolder = Record<string, unknown> & { x: number; y: number };
type HeldAim = { character: AimHolder; gameAim: { x: unknown; y: unknown } };

export type SwingAim = Readonly<{ axisX: number; axisY: number; along: number; across: number }>;

export const LEVEL_SWING: SwingAim = Object.freeze({ axisX: 0, axisY: 1, along: 0, across: 1 });

export type SweepState = {
  active: boolean; direction: number; range: number; inverse: boolean; swing: SwingAim | null; sideCarry: number; ragdollCarry: number;
  held: HeldAim | null; holdsKeys: boolean;
};

export const sweep: SweepState = { active: false, direction: 1, range: 0, inverse: false, swing: null, sideCarry: 0, ragdollCarry: 0, held: null, holdsKeys: false };

type KeyName = 'ragdoll' | 'mouse' | 'left' | 'right';
type HeldKeys = Partial<Record<KeyName, boolean>>;
const keys = game as unknown as { holdKeys(held: HeldKeys): void };
const keysHeld = new Set<KeyName>();

export function holdKeys(wanted: Readonly<{ ragdoll: boolean | null; mouse: boolean; side: number | null }>): void {
  const held: HeldKeys = {};
  if (wanted.ragdoll !== null) held.ragdoll = wanted.ragdoll;
  if (wanted.mouse) held.mouse = true;
  if (wanted.side !== null) {
    held.left = wanted.side < 0;
    held.right = wanted.side > 0;
  }
  for (const name of Object.keys(held) as KeyName[]) keysHeld.add(name);
  sweep.holdsKeys = keysHeld.size > 0;
  keys.holdKeys(held);
}

function releaseKeys(): void {
  if (!keysHeld.size) return;
  const released: HeldKeys = {};
  for (const name of keysHeld) released[name] = false;
  keysHeld.clear();
  sweep.holdsKeys = false;
  keys.holdKeys(released);
}

export function cursorSide(character: AimHolder, deadZone: number): number {
  const cursorX = sweep.held?.gameAim.x;
  if (typeof cursorX !== 'number' || Math.abs(cursorX - character.x) <= deadZone) return 0;
  return Math.sign(cursorX - character.x);
}

export function releaseAim(): void {
  releaseKeys();
  const { held } = sweep;
  if (!held) return;
  sweep.held = null;
  Reflect.deleteProperty(held.character, AIM_X_FIELD);
  Reflect.deleteProperty(held.character, AIM_Y_FIELD);
  held.character[AIM_X_FIELD] = held.gameAim.x;
  held.character[AIM_Y_FIELD] = held.gameAim.y;
}

function swingOffset(swing: SwingAim): { x: number; y: number } {
  const across = sweep.direction * swing.across;
  return {
    x: sweep.range * (swing.along * swing.axisX + across * swing.axisY),
    y: sweep.range * (swing.along * swing.axisY - across * swing.axisX),
  };
}

function aimHeight(character: AimHolder, gameAimY: unknown): unknown {
  return sweep.inverse && typeof gameAimY === 'number' ? character.y + (character.y - gameAimY) : gameAimY;
}

export function holdAim(character: AimHolder): void {
  if (sweep.held?.character === character) return;
  releaseAim();
  const held: HeldAim = { character, gameAim: { x: character[AIM_X_FIELD], y: character[AIM_Y_FIELD] } };
  Object.defineProperty(character, AIM_X_FIELD, {
    configurable: true,
    enumerable: true,
    get: (): number => character.x + swingOffset(sweep.swing ?? LEVEL_SWING).x,
    set: (gameAimX: unknown): void => { held.gameAim.x = gameAimX; },
  });
  Object.defineProperty(character, AIM_Y_FIELD, {
    configurable: true,
    enumerable: true,
    get: (): unknown => (sweep.swing === null ? aimHeight(character, held.gameAim.y) : character.y + swingOffset(sweep.swing).y),
    set: (gameAimY: unknown): void => { held.gameAim.y = gameAimY; },
  });
  sweep.held = held;
}

export function setSweeping(active: boolean): void {
  sweep.active = active;
  sweep.direction = 1;
  sweep.sideCarry = 0;
  sweep.ragdollCarry = 0;
  if (!active) releaseAim();
}

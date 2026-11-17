import { GROUP, SETTING_TYPE } from '#console/kernel/state/keys.ts';
import type { KeySpec } from '#console/kernel/state/schema.ts';
import { DEFAULT_FAST, DEFAULT_SPEED } from './constants.ts';

export const COMMAND = Object.freeze({ name: 'freecam', on: 'on', off: 'off' });
export const SETTING = Object.freeze({ speed: 'freecam_speed', fast: 'freecam_fast' });
export const FRAME_HOOK_NAME = 'FreeCamera';
export const EVENT = Object.freeze({ mouseDown: 'mousedown', mouseMove: 'mousemove', mouseUp: 'mouseup', blur: 'blur' });
export const SHIFT_CODES: readonly string[] = Object.freeze(['ShiftLeft', 'ShiftRight']);
export const PAN_KEYS: Readonly<Record<string, readonly [number, number]>> = Object.freeze({
  KeyW: [0, -1], ArrowUp: [0, -1], KeyS: [0, 1], ArrowDown: [0, 1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0], KeyD: [1, 0], ArrowRight: [1, 0],
});

export const SETTINGS: Readonly<Record<string, KeySpec>> = Object.freeze({
  [SETTING.speed]: {
    type: SETTING_TYPE.number, group: GROUP.player, min: 50, max: 10000, default: DEFAULT_SPEED, example: '1500',
    desc: 'How fast "freecam" pans, in screen pixels a second (the game is 800 wide), the same at any zoom',
  },
  [SETTING.fast]: {
    type: SETTING_TYPE.number, group: GROUP.player, min: 1, max: 20, default: DEFAULT_FAST, example: '5',
    desc: 'How many times faster "freecam" pans while Shift is held',
  },
});

import type { KeySpec } from '#console/kernel/state/schema.ts';
import { GROUP, SETTING_TYPE } from '#console/kernel/state/keys.ts';
import { CAPABILITY } from '#shared/features/keys.ts';
import { FLY_MODE } from '../../keys.ts';

const FLY = CAPABILITY.movement.fly;

export const SETTINGS: Readonly<Record<string, KeySpec>> = Object.freeze({
  fly: {
    capability: FLY, type: SETTING_TYPE.bool, extraValues: [FLY_MODE.free, FLY_MODE.sweep, FLY_MODE.sword], example: FLY_MODE.free, group: GROUP.player,
    desc: 'Fly: "on" = up/down with jump/crouch, "free" = glide in every direction (turns gravity off), "sweep" = the aim sweep holding ragdoll (X), for guns, "sword" = the same holding the mouse button too, for swords',
    about: [
      'on: jump and crouch move you straight up and down at fly_speed; you run left and right as usual.',
      'free: the movement keys push you in all four directions and you glide to a stop, like a spaceship.',
      'sweep: arms the aim sweep with ragdoll (X) held, for guns; "fly sweep --on/--off/--toggle" runs it (60 FPS, high physics).',
      'sword: the same with the mouse button held too, for swords; "fly sword --on/--off/--toggle".',
      'Settings for on: fly_speed. For free: fly_accel_x, fly_accel_y, fly_drag, fly_lift, fly_upright. For sweep: fly_sweep_range.',
    ],
  },
  fly_speed: { capability: FLY, type: SETTING_TYPE.number, group: GROUP.player, min: 0.5, max: 50, default: 6, desc: 'Up/down speed for "fly on"', example: '10' },
  fly_accel_x: { capability: FLY, type: SETTING_TYPE.number, group: GROUP.player, min: 0, max: 10, default: 1, desc: 'Left/right push for "fly free"', example: '1.5' },
  fly_accel_y: { capability: FLY, type: SETTING_TYPE.number, group: GROUP.player, min: 0, max: 10, default: 0.8, desc: 'Up/down push for "fly free"', example: '1.2' },
  fly_drag: {
    capability: FLY, type: SETTING_TYPE.number, group: GROUP.player, min: 0.5, max: 1, default: 0.98, desc: 'Share of speed kept every 1/60 s in "fly free" (1 = never slows down)', example: '0.95',
  },
  fly_lift: {
    capability: FLY, type: SETTING_TYPE.number, group: GROUP.player, min: 0, max: 2, default: 0.98, desc: 'Share of gravity canceled in "fly free" (1 = hover still, less = slow sink)', example: '1',
  },
  fly_sweep_range: {
    capability: FLY, type: SETTING_TYPE.number, group: GROUP.player, min: 50, max: 3000, default: 700,
    desc: 'How far left and right of you "fly sweep" aims, in game units (above 1000 is held back in approved matches)', example: '900',
  },
  fly_upright: { capability: FLY, type: SETTING_TYPE.bool, group: GROUP.player, default: true, desc: 'Keep you on your feet in "fly free"' },
});

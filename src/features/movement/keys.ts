export const OVERRIDE_NAME = Object.freeze({ speed: 'speed override', jump: 'jump override', gravity: 'gravity override', fly: 'fly override', swords: 'swords override', worldGravity: 'world gravity override' });
export const SETTING = Object.freeze({ speed: 'speed', jump: 'jump', gravity: 'gravity', fly: 'fly', flySpeed: 'fly_speed', flyAccelX: 'fly_accel_x', flyAccelY: 'fly_accel_y', flyDrag: 'fly_drag', flyLift: 'fly_lift', flyUpright: 'fly_upright', flySweepRange: 'fly_sweep_range', swords: 'swords', worldGravity: 'world_gravity' });
export const FLY_MODE = Object.freeze({ vertical: true, free: 'free', sweep: 'sweep' } as const);
export const FLY_COMMAND = Object.freeze({ name: 'fly', on: 'on', off: 'off', toggle: 'toggle' });
export const AIM_X_FIELD = 'tarx';
export const SWEEP_FPS_CHOICE = 3;

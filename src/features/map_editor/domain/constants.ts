export type Box = Readonly<{ x: number; y: number; w: number; h: number }>;

export const DECIMAL_RADIX = 10;
export const HISTORY_MAX_ENTRIES = 200;
export const FIRST_ACTION_SLOT = 1;

export const BOX = Object.freeze({
  actor: { x: -15, y: -82, w: 30, h: 82 },
  gun: { x: -25, y: -7, w: 50, h: 14 },
  marker: { x: -16, y: -16, w: 32, h: 32 },
  barrel: { x: -15, y: -20, w: 30, h: 40 },
  vehicle: { x: -21, y: -21, w: 42, h: 42 },
});

export const VEHICLE_BOX: Readonly<Record<string, Box>> = Object.freeze({
  veh_jeep: { x: -99, y: -32, w: 222, h: 111 },
  veh_walker: { x: -110, y: -56, w: 233, h: 257 },
  veh_capsule: { x: -30, y: -60, w: 60, h: 120 },
  veh_crate: { x: -30, y: -30, w: 60, h: 60 },
  veh_drone: { x: -13, y: -11, w: 45, h: 34 },
  veh_rope: { x: -10, y: 0, w: 20, h: 188 },
  veh_corvette: { x: -49, y: -46, w: 182, h: 129 },
});

export const CHAR_PICTURE_DIGITS = 4;

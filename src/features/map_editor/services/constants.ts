export const MAX_LOOPS = 6;
export const FAR = 1e7;
export const HALF = 2;

export const EDGE_TESTS: readonly (readonly [number, number, number, number])[] = Object.freeze([
  [-15, -30, -15, 75],
  [5, -5, 5, -50],
] as const);

export const GUN_SEARCH = 400;
export const LAMP_STATE = Object.freeze({ off: 0, flare: 2 });
export const TIE_TYPE = Object.freeze({ pusher: 3, water: 5 });

export const LOADER_USE_ON: Readonly<Record<number, number>> = Object.freeze({ 8: 1, 11: 9, 12: 10, 15: 1 });
export const SWITCH_MODES: ReadonlySet<number> = new Set([1, 9, 10]);
export const FIRST_ACTION = 1;
export const TRIGGER_ACTIONS_LIMIT = 100;
export const SCALE_UNIT = 100;
export const WATER_GROWTH = Object.freeze({ side: 10, below: 10, sides: 2 });

export const PICK_SLOP = 2;
export const SAME_SPOT = 3;

export const DUPLICATE_OFFSET = 20;
export const NEW_RECT = 100;
export const TIDY_PRECISION = 100;

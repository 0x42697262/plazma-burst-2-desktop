// Trigger action types: the map editor's action numbers, as handled in scripts/actions.js.
// Only the ones the console needs are named.
export const ACTION = Object.freeze({
  DISABLE_TRIGGER: 19,
  ENABLE_TRIGGER: 20,
  ENABLE_TIMER: 25,
  DISABLE_TIMER: 26,
  MOVE_TO_REGION: 30,
  RUN_TRIGGER: 99,
  RUN_REGION_TRIGGER: 440,
  RUN_REGION_TRIGGER_TOO: 499,
  // Variable sync: send this client's value with a merge mode (see game/vars.js).
  SYNC_REPLACE: 223,
  SYNC_DEFAULT: 224,
  SYNC_MAX: 225,
  SYNC_MIN: 226,
  SYNC_LONGEST: 227,
});

// Names shown next to an action number, for the types confirmed in actions.js.
export const ACTION_NAMES = Object.freeze({
  [ACTION.DISABLE_TRIGGER]: 'disable trigger A',
  [ACTION.ENABLE_TRIGGER]: 'enable trigger A',
  [ACTION.ENABLE_TIMER]: 'enable timer A',
  [ACTION.DISABLE_TIMER]: 'disable timer A',
  [ACTION.MOVE_TO_REGION]: 'move character A to region B',
  [ACTION.RUN_TRIGGER]: 'run trigger A',
  [ACTION.RUN_REGION_TRIGGER]: 'run the trigger of region A',
  [ACTION.RUN_REGION_TRIGGER_TOO]: 'run the trigger of region A',
});

export const RUNS_REGION_TRIGGER = new Set([ACTION.RUN_REGION_TRIGGER, ACTION.RUN_REGION_TRIGGER_TOO]);

// Every action type that writes the variable named by its target A, read out of
// scripts/actions.js: each "case" that assigns to the variable store under that name,
// directly or through one of the action loop's aliases for target A.
export const VAR_WRITE_TYPES = new Set([
  100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 118, 119, 122, 124, 125, 127, 131,
  132, 133, 134, 135, 136, 137, 138, 139, 140, 145, 146, 147, 148, 149, 150, 151, 152,
  153, 154, 155, 157, 158, 159, 160, 177, 178, 180, 181, 182, 183, 184, 185, 186, 187,
  188, 189, 198, 204, 205, 206, 235, 236, 247, 248, 249, 263, 266, 277, 278, 280, 294,
  295, 314, 315, 316, 325, 326, 327, 328, 331, 332, 333, 334, 335, 336, 337, 344, 348,
  349, 350, 354, 369, 373, 376, 393, 394, 397, 398, 399, 405, 410, 425, 426, 427, 428,
  434, 435, 436, 454, 463, 471, 472, 474, 484, 495, 496, 497, 508, 509, 510, 531, 544,
  552, 555,
]);

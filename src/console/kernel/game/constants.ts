export const GAME_WIDTH = 800;
export const GAME_HEIGHT = 400;
export const BODY_MIDDLE = 41;
export const ENTER_KEY_CODE = 13;
export const FIRST_SLOT = 1;
export const LAST_SLOT = 9;
export const EMPTY_SLOT = -1;
export const NO_CAMERA_TARGET = -1;
export const DEFAULT_PARENT_SCALE = 1;
export const GRID_MARGIN = 100;
export const TEXTURE_SCALE = 100;
export const TOP_ANCHORS: readonly number[] = Object.freeze([0, -23, -6]);
export const BOTTOM_ANCHOR = -16;
export const TRIM_ABOVE = 23;
export const TRIM_RIGHT_PAST = 16;
export const TRIM_SLACK = 1;
export const CORNER = Object.freeze({ topLeft: 0, topRight: 1, bottomRight: 2, bottomLeft: 3 });
export const COORDINATE_COUNT = 2;
export const CHARACTER_SUFFIX_WORDS = 2;

export const ACTION = Object.freeze({
  DISABLE_TRIGGER: 19,
  ENABLE_TRIGGER: 20,
  ENABLE_TIMER: 25,
  DISABLE_TIMER: 26,
  MOVE_TO_REGION: 30,
  RUN_TRIGGER: 99,
  JUMP_TO_TRIGGER: 363,
  RUN_REGION_TRIGGER: 440,
  RUN_REGION_TRIGGER_TOO: 499,
  SYNC_REPLACE: 223,
  SYNC_DEFAULT: 224,
  SYNC_MAX: 225,
  SYNC_MIN: 226,
  SYNC_LONGEST: 227,
});

export const RUNS_REGION_TRIGGER: ReadonlySet<number> = new Set([ACTION.RUN_REGION_TRIGGER, ACTION.RUN_REGION_TRIGGER_TOO]);

export const VAR_WRITE_TYPES: ReadonlySet<number> = new Set([
  100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 118, 119, 122, 124, 125, 127, 131,
  132, 133, 134, 135, 136, 137, 138, 139, 140, 145, 146, 147, 148, 149, 150, 151, 152,
  153, 154, 155, 157, 158, 159, 160, 177, 178, 180, 181, 182, 183, 184, 185, 186, 187,
  188, 189, 198, 204, 205, 206, 235, 236, 247, 248, 249, 263, 266, 277, 278, 280, 294,
  295, 314, 315, 316, 325, 326, 327, 328, 331, 332, 333, 334, 335, 336, 337, 344, 348,
  349, 350, 354, 369, 373, 376, 393, 394, 397, 398, 399, 405, 410, 425, 426, 427, 428,
  434, 435, 436, 454, 463, 471, 472, 474, 484, 495, 496, 497, 508, 509, 510, 531, 544,
  552, 555,
]);

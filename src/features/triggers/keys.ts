export const FRAME_HOOK_NAME = 'Trigger history';
export const LIST_SECTION = Object.freeze({ logic: 'logic', vars: 'vars' });

export const REGION_MODE = Object.freeze({
  NEVER: 0, USE: 1, ENTER: 2, VEHICLE_ENTERS: 3, ANYTHING_ENTERS: 4, DOOR_ARRIVES: 5,
  PLAYER_ENTERS: 6, TEAM_INSIDE: 7, USE_RED: 9, USE_BLUE: 10, RED_ENTERS: 13, BLUE_ENTERS: 14,
  BOT_ENTERS: 17, ENEMY_BOT_ENTERS: 18,
});
export const TEAM = Object.freeze({ RED: 12, BLUE: 13 });
export const NO_VEHICLE = -1;
export const NO_TARGET = -1;
export const UNLIMITED = -1;
export const SOURCE = Object.freeze({
  REGION: 'region', TIMER: 'timer', CHAT: 'chat', DEATH: 'death', TRIGGER: 'trigger', START: 'start',
} as const);
export type SourceKind = typeof SOURCE[keyof typeof SOURCE];
export const UID_TAGS = Object.freeze(['region', 'timer', 'player'] as const);
export type UidTag = typeof UID_TAGS[number];
export const UID_ELEMENT = /<(region|timer|player)\b([^>]*)>/g;
export const UID_ATTRIBUTE = /\buid="([^"]*)"/;
export const INTEGER_TEXT = /^-?\d+$/;
export const UID_MARK = '#';
export const FORCE_WORDS: readonly string[] = Object.freeze(['force', '-f']);
export const AS_WORD = 'as';
export const OBJECT_KINDS: ReadonlySet<string> = new Set(['door', 'region', 'vehicle', 'character', 'gun', 'barrel', 'trigger', 'timer',
  'decor', 'pushf', 'pushf_damage', 'lamp', 'water']);
export const TARGET_SIDES = Object.freeze(['A', 'B'] as const);

export const HEADERS: readonly string[] = Object.freeze(['uid', 'enabled', 'maxcalls']);
export const OP_NUMBER = /^op(-?\d+)$/;
export const ACTION_END = '" );';
export const ACTION_START = '( "';
export const TARGET_SEPARATOR = '", "';
export const NAME_END = '(';
export const HEADER_SEPARATOR = ':';
export const SCRIPT_MARK = /\(\s"/;
export const LINE_BREAK = /[\r\n]/;
export const LINE_SPLIT = /\r?\n/;
export const HEADER_LINE = /^(uid|enabled|maxcalls)\s*:\s*(\S*)\s*/i;
export const WHITESPACE = /\s+/g;
export const WORDS = /\s+/;
export const OPCODES_GLOBAL = 'PB2_OPCODES';

export const VAR_SYNC_MARK = 'mark="var_sync"';
export const QUOTE = '"';
export const SYNC_MODE = Object.freeze({ replace: 'r', default: 'd', max: 'x', min: 'n', longest: 'l' } as const);
export const SYNC_MODE_KEYS = Object.freeze([SYNC_MODE.replace, SYNC_MODE.default, SYNC_MODE.max, SYNC_MODE.min, SYNC_MODE.longest] as const);
export type SyncModeKey = typeof SYNC_MODE_KEYS[number];
export const RECOMMENDED_MODE: SyncModeKey = 'r';
export const FIGHTING_MODES: ReadonlySet<string> = new Set(['x', 'n']);
export const VERDICT = Object.freeze({ no: 'no', yes: 'yes', raiseOnly: 'raise only', lowerOnly: 'lower only', longerOnly: 'longer only' } as const);

export const STACK_FRAME_LIMIT = 1;
export const SETTING = Object.freeze({ triggerHistory: 'trigger_history' });

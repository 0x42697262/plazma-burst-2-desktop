import { CHAR_PICTURE_DIGITS } from './constants.ts';
import type { Attrs } from './doc.ts';

export const ELEMENT_PATTERN = /<([a-z_0-9]+)((?:\s+[A-Za-z0-9_]+="[^"]*")*)\s*\/?>/g;
export const ATTRIBUTE_PATTERN = /([A-Za-z0-9_]+)="([^"]*)"/g;
export const NEW_ELEMENT_PREFIX = '\n';
export const serializeElement = (tag: string, attrs: Attrs): string => `<${tag}${Object.entries(attrs).map(([name, value]) => ` ${name}="${value}"`).join('')} />`;

export const TAG = Object.freeze({
  box: 'box', door: 'door', region: 'region', bg: 'bg', water: 'water', pushf: 'pushf', player: 'player', enemy: 'enemy',
  vehicle: 'vehicle', barrel: 'barrel', gun: 'gun', decor: 'decor', lamp: 'lamp', trigger: 'trigger', timer: 'timer', song: 'song',
  inf: 'inf', image: 'image',
} as const);
export const CHARACTER_TAGS: ReadonlySet<string> = new Set([TAG.player, TAG.enemy]);

export const SHAPE = Object.freeze({ RECT: 'rect', POINT: 'point' } as const);
export type Shape = typeof SHAPE[keyof typeof SHAPE];

export const KIND_LOOK = Object.freeze({
  box: { title: 'wall', color: '#cfd8e3' },
  door: { title: 'movable', color: '#ffb347' },
  region: { title: 'region', color: '#3C9DFF' },
  bg: { title: 'background', color: '#7a8a99' },
  water: { title: 'water', color: '#33c3ff' },
  pushf: { title: 'pusher', color: '#c77dff' },
  player: { title: 'player', color: '#ff6666' },
  enemy: { title: 'enemy', color: '#ff3355' },
  vehicle: { title: 'vehicle', color: '#e0c341' },
  barrel: { title: 'barrel', color: '#ff7b39' },
  gun: { title: 'gun', color: '#9cff6b' },
  decor: { title: 'decoration', color: '#b3e5c5' },
  lamp: { title: 'lamp', color: '#fff27a' },
  trigger: { title: 'trigger', color: '#33ff33' },
  timer: { title: 'timer', color: '#ffd84d' },
  song: { title: 'song', color: '#ff9ad5' },
  inf: { title: 'engine mark', color: '#ffffff' },
  image: { title: 'image info', color: '#a0a0ff' },
});

export const DEFAULTS: Readonly<Record<string, Readonly<Attrs>>> = Object.freeze({
  box: { m: '0' },
  door: { moving: 'false', tarx: '0', tary: '0', maxspeed: '10', vis: 'true', attach: '-1' },
  region: { use_target: '-1', use_on: '0', attach: '-1' },
  bg: { m: '0', c: '', a: '-1', u: '0', v: '0', f: '0', s: 'true' },
  water: { damage: '0', friction: 'true' },
  pushf: { tox: '0', toy: '0', stab: '0', damage: '0', attach: '-1' },
  player: { tox: '0', toy: '0', hea: '130', hmax: '130', team: '0', side: '1', char: '1', incar: '-1', botaction: '0', ondeath: '-1' },
  enemy: { tox: '0', toy: '0', hea: '130', hmax: '130', team: '0', side: '1', char: '1', incar: '-1', botaction: '0', ondeath: '-1' },
  vehicle: { side: '1', model: 'veh_jeep', tox: '0', toy: '0', hpp: '100' },
  barrel: { model: 'bar_orange', tox: '0', toy: '0' },
  gun: { model: 'gun_rifle', command: '-1', upg: '0' },
  decor: { model: 'stone', attach: '-1', u: '0', v: '0', f: '0', r: '0', sx: '1', sy: '1' },
  lamp: { power: '0.4', flare: '1' },
  trigger: { enabled: 'true', maxcalls: '1' },
  timer: { enabled: 'true', maxcalls: '1', target: '-1', delay: '30' },
  song: { url: '', volume: '1', loop: 'true', callback: '-1' },
  inf: { mark: 'hero1_guns', forteam: '0' },
  image: { id: '0', width: '100', height: '100' },
});
export const NO_UID: ReadonlySet<string> = new Set([TAG.box, TAG.bg, TAG.inf, TAG.image]);
export const NOT_PLACED: ReadonlySet<string> = new Set([TAG.image]);
export const uidPrefix = (tag: string): string => `#${tag}*`;

export const CHANGE = Object.freeze({ attrs: 'attrs', insert: 'insert', remove: 'remove' } as const);

export const ACTION_PATTERN = /^actions_(\d+)_(type|targetA|targetB)$/;
export const ACTION_SIDE = Object.freeze({ type: 'type', targetA: 'targetA', targetB: 'targetB' } as const);
export type ActionPart = typeof ACTION_SIDE[keyof typeof ACTION_SIDE];
export const actionAttr = (slot: number, part: ActionPart): string => `actions_${slot}_${part}`;
export const EMPTY_TYPE = '-1';
export const TRIGGER_HEADERS: readonly string[] = Object.freeze(['uid', 'enabled', 'maxcalls']);
export const NO_ACTIONS_PATTERN = /no actions in the script/;
export const HEADER_PATTERN = /^\s*(uid|enabled|maxcalls)\s*:\s*(.*?)\s*$/gim;

export type Picture = { src: string; fit?: boolean; head?: boolean };
type GameOnlyParam = { kind: string; title: string; desc: string; value: string };

export const UID_ATTR = 'uid';
export const PLACE_ATTRS: readonly string[] = Object.freeze(['x', 'y']);
export const SIZE_ATTRS: readonly string[] = Object.freeze(['w', 'h']);
export const ANY_KIND = '*';
export const UNPAIRED = 'nochange';
export const TRIGGER_TYPE_KIND = 'trigger_type';
export const KIND_SEPARATOR = '+';
export const CUSTOM_VALUE_MARK = '[val]';
export const NEGATIVE_MARK = '-';
export const ACTION_CATEGORY_SEPARATOR = ' › ';
export const DEFAULT_ACTION_COLOR = '#ffffff';
export const NO_PLACE: ReadonlySet<string> = new Set([TAG.image]);
export const PAIRED: Readonly<Record<string, Readonly<Record<string, string>>>> = Object.freeze({ inf: { forteam: 'mark' } });

export const GAME_ONLY: Readonly<Record<string, Readonly<Record<string, GameOnlyParam>>>> = Object.freeze({
  water: { attach: { kind: 'door+none', title: 'Attach to', desc: 'Attaches water to movable (read by the game, not shown by the map editor)', value: '-1' } },
  door: { mute: { kind: 'bool', title: 'Mute', desc: 'No sound when it starts and stops moving (read by the game, not shown by the map editor)', value: 'false' } },
  region: { uses_timer: { kind: 'bool', title: 'Uses timer', desc: 'Activation enables the timer "Activation Trigger" names instead of running a trigger (read by the game, not shown by the map editor)', value: 'false' } },
  trigger: { execute: { kind: 'bool', title: 'Run at start', desc: 'Runs when the level starts, and when a match starts a new round (read by the game, not shown by the map editor)', value: 'false' } },
  decor: { text: { kind: 'string', title: 'Text', desc: 'What a text decoration (models text, text2, text3) says (read by the game, not shown by the map editor)', value: '' } },
});

export const PICKS: Readonly<Record<string, readonly string[]>> = Object.freeze({
  trigger: ['trigger'], 'trigger+none': ['trigger'], timer: ['timer'],
  door: ['door'], 'door+none': ['door'], region: ['region'], 'region+random': ['region'],
  character: ['player', 'enemy'], vehicle: ['vehicle'], 'vehicle+none+any': ['vehicle'],
  gun: ['gun'], barrel: ['barrel'], decor: ['decor'], lamp: ['lamp'], water: ['water'], pushf: ['pushf'],
  'song+none': ['song'],
});

const DIGITS = /^\d+$/;
export const PICTURES: Readonly<Record<string, (value: string) => Picture | null>> = Object.freeze({
  decor_model: (value: string) => ({ src: `/level_editor/decors/${value}.png`, fit: true }),
  char: (value: string) => (DIGITS.test(value) ? { src: `/level_editor/chars_full/char${value.padStart(CHAR_PICTURE_DIGITS, '0')}.png`, head: true } : null),
  sky_model: (value: string) => ({ src: `/level_editor/pic.php?m=${value}&c=6`, fit: true }),
});

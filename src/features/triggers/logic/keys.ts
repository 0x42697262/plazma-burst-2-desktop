export const LINK = Object.freeze({ START: 'start', CONTROL: 'control', ACT: 'act', ATTACH: 'attach', REF: 'ref' } as const);
export type LinkKind = typeof LINK[keyof typeof LINK];
export const STARTING_ATTRS: ReadonlySet<string> = new Set(['use_target', 'target', 'ondeath']);
export const ATTACH_ATTR = 'attach';
export const UID_ATTR = 'uid';
export const USE_TARGET_ATTR = 'use_target';
export const USES_TIMER_ATTR = 'uses_timer';
export const USES_TIMER_VALUES: ReadonlySet<string> = new Set(['true', '1']);
export const ACTION_ATTR = /^actions_(\d+)_target[AB]$/;
export const TARGET_A_SUFFIX = 'A';
export const typeAttr = (action: string): string => `actions_${action}_type`;
export const TAG = /<([a-z_]+)((?:\s+[A-Za-z0-9_]+="[^"]*")*)\s*\/?>/g;
export const ATTR = /([A-Za-z0-9_]+)="([^"]*)"/g;
export const NUMBERED: ReadonlySet<string> = new Set(['trigger', 'timer', 'region', 'door', 'decor', 'player', 'enemy', 'vehicle', 'gun',
  'barrel', 'lamp', 'water', 'pushf', 'song']);
export const ATTR_KIND: Readonly<Record<string, string>> = Object.freeze({
  use_target: 'trigger', target: 'trigger', ondeath: 'trigger', callback: 'trigger',
  attach: 'door', a: 'door', incar: 'vehicle',
});
export const TARGET_KIND: Readonly<Record<string, string>> = Object.freeze({
  trigger: 'trigger', timer: 'timer', region: 'region', door: 'door', decor: 'decor', character: 'character',
  vehicle: 'vehicle', gun: 'gun', barrel: 'barrel', lamp: 'lamp', water: 'water', pushf: 'pushf', pushf_damage: 'pushf',
});
export const CHARACTER_TAGS: ReadonlySet<string> = new Set(['player', 'enemy']);
export const CHARACTER_KIND = 'character';
export const TIMER_KIND = 'timer';
export const TRIGGER_KIND = 'trigger';
export const REGION_TAG = 'region';
export const WHOLE = /^\d+$/;
export const INDEX_QUERY = /^#?\d+$/;
export const UID_MARK = '#';
export const UNPLACED_TAGS: ReadonlySet<string> = new Set(['trigger', 'timer', 'inf', 'image']);
export const nameless = (tag: string, index: number): string => `${tag}#${index}`;

export const LAYER = 'logic';
export const LINK_COLOR: Readonly<Record<LinkKind, string>> = Object.freeze({
  start: '#33ff33', control: '#ffd84d', act: '#3C9DFFcc', attach: '#ffffff66', ref: '#ff66ffcc',
});
export const NODE_COLOR: Readonly<Record<string, string>> = Object.freeze({ trigger: '#33ff33', timer: '#ffd84d', region: '#3C9DFF', player: '#ff6666' });
export const OTHER_NODE_COLOR = '#ffffff';

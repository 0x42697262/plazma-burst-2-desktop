import { DEFAULT_RULE as RULE, FIELD_KIND as KIND } from '../../keys.ts';

export const DEFAULT_WORDS: Readonly<Record<string, string>> = Object.freeze({
  [RULE.zero]: '0',
  [RULE.empty]: '(empty)',
  [RULE.aim]: 'aim',
  [RULE.area]: 'area',
  [RULE.ally]: 'closest ally',
  [RULE.near]: 'near',
  [RULE.self]: 'you',
  [RULE.replyId]: '(automatic)',
  [RULE.myHmax]: 'your max HP',
  [RULE.myGun]: 'your gun',
  [RULE.myPosX]: 'your x',
  [RULE.myPosY]: 'your y',
  [RULE.targetRespawns]: "target's count",
});

export const KIND_WORDS: Readonly<Record<string, string>> = Object.freeze({
  [KIND.slot]: 'player',
  [KIND.authId]: 'player',
  [KIND.number]: 'number',
  [KIND.decimal]: 'number',
  [KIND.text]: 'text',
  [KIND.json]: 'JSON',
  [KIND.flag]: 'flag',
  [KIND.choice]: 'choice',
});

export const VALUE_BY_KIND: Readonly<Record<string, string>> = Object.freeze({
  [KIND.slot]: '#n, name, me, ally, enemy',
  [KIND.authId]: '#n, name, or an auth id',
  [KIND.number]: 'a number',
  [KIND.decimal]: 'a number, e.g. 3.5',
  [KIND.text]: 'any text',
  [KIND.json]: 'a JSON object',
  [KIND.flag]: '1 or 0',
});

export const hintKey = (message: string, field: string): string => `${message}.${field}`;

export const VALUE_HINTS: Readonly<Record<string, string>> = Object.freeze({
  'HIT_PLAYER.limb': '0-3; 0 hurts most',
  'HIT_PLAYER.power': 'gun power, e.g. 3.5',
  'HIT_PLAYER.knockback': '1 normal, 0 none',
  'HIT_PLAYER.frame': 'a frame; 41 = no damage',
  'HIT_PLAYER.cclass': 'projectile class number',
  'HIT_PLAYER.source': 'a gun index or a cause code',
  'HIT_PLAYER.atom': '0-9 body segment',
  'HIT_PLAYER.damage': 'HP taken, e.g. 25',
  'HEAL_PLAYER.power': 'heal power, e.g. 5',
  'HEAL_PLAYER.gun': 'a gun index; your held gun',
  'EXEC_TRIGGER.trigger': 'a trigger index (see triggers)',
  'EXEC_TRIGGER.region': 'a region index, or empty',
  'EXEC_TRIGGER.power': 'activation power',
  'RESPAWN.hp': 'HP, e.g. 100',
  'RESSURECT.hp': 'HP, e.g. 100',
  'VAR_SYNC.name': 'a map variable name (see vars)',
  'VAR_SYNC.value': 'the value to set',
  'BARREL.barrel': 'a barrel index',
  'BARREL.hp': 'HP left; 0 explodes it',
  'THROW_GUN.gun': 'a gun index',
  'CHAT.destination': '1 everyone, 2 team',
  'CHAT.text': 'the message',
  'JOIN_MATCH.uid': 'a match uid; -1 to leave',
  'JOIN_MATCH.slot': '-1 any, -100 spectate, or n',
  'CREATE_MATCH.settings': 'see protocol-crafting.md',
  'MY_PLAYER_PROPERTIES_CHANGED.property': '0 team, 1 skin, 2-11 slots, 12 gun',
  'AI_STATE_SYNC.hunt': 'a slot to chase, -1 none',
  'AI_STATE_SYNC.action': 'a bot action code',
  'AI_HEALTH_SYNC.head': 'head HP',
  'AI_HEALTH_SYNC.body': 'body HP',
  'AI_HEALTH_SYNC.arms': 'arms HP',
  'AI_HEALTH_SYNC.legs': 'legs HP',
  'FLOW_AT.count': 'how many times it repeats',
});

export type ValueRow = readonly [value: string, meaning: string];

const rows = (...list: ValueRow[]): readonly ValueRow[] => Object.freeze(list);

const SOURCE_VALUES: readonly ValueRow[] = rows(
  ['a gun index', 'that gun, from the map\'s gun list; a kill reads "via <gun>"'],
  ['-1', 'a grenade; also what "your gun" sends with no gun in hand'],
  ['-11', 'swords, a melee hit; a kill reads "sliced" or "cut"'],
  ['-12', 'a barrel'],
  ['-13', 'level logic'],
  ['-14', 'acid'],
  ['-15', 'a wall'],
  ['-16', 'nothing'],
  ['-17', 'out of bounds; a kill reads "flew out of bounds"'],
  ['anything else', 'the game shows "Unknown source"'],
);

export const VALUE_TABLES: Readonly<Record<string, readonly ValueRow[]>> = Object.freeze({
  'HIT_PLAYER.source': SOURCE_VALUES,
  'DAMAGE_PLAYERS_VIA_EXPLOSION.source': SOURCE_VALUES,
  'HIT_PLAYER.limb': rows(
    ['0', 'the head: damage x55, and a kill adds "[ Headshot ]"'],
    ['1', 'damage x20; the game sends it only for a victim who is down'],
    ['2', 'damage x30'],
    ['3', 'damage x25; an explosion counts as this'],
  ),
  'HIT_PLAYER.frame': rows(
    ['41', 'no damage, and it is sent even between teammates'],
    ['29, 51', 'the second hit effect'],
    ['anything else', 'a normal hit'],
  ),
  'PROJECTILE_CREATE.gun': rows(
    ['a gun index', 'that gun; others create the shot only if they see you holding it'],
    ['-1, -2, -3', 'a grenade of type 1, 2 or 3, thrown from your body'],
    ['below -3', 'nothing is created'],
  ),
  'VAR_SYNC.mode': rows(
    ['r', 'take the value as it comes'],
    ['d', 'take it only where the variable is unset or not a number'],
    ['x', 'keep the larger number'],
    ['n', 'keep the smaller number'],
    ['l', 'keep the longer text'],
  ),
  'CHAT.destination': rows(
    ['1', 'everyone in the match'],
    ['2', 'your team only'],
  ),
  'JOIN_MATCH.slot': rows(
    ['-1', 'any free player slot'],
    ['-100', 'a spectator slot'],
    ['a slot index', 'that slot if it is free, else any free player slot'],
  ),
  'KICK_USER.allGuests': rows(
    ['1', 'for a guest target, also bar every guest from the match'],
    ['0 or empty', 'bar only this player'],
  ),
  'MY_PLAYER_PROPERTIES_CHANGED.property': rows(
    ['0', 'team'],
    ['1', 'skin_snapshot'],
    ['2-11', 'slot0 to slot9, the gun in that slot'],
    ['12', 'curwea, the gun in hand'],
  ),
});

export const HELP_TEXT = Object.freeze({
  usage: 'wire help <message> [field]',
  desc: "Show what a message does, and each field's type, default and meaning",
  heading: (name: string, direction: string) => `${name}  (${direction})`,
  noteLine: (note: string) => `  note: ${note}`,
  description: (text: string) => `  ${text}`,
  setHint: '  Set a field as name=value, or give values in the order below. A field you leave out takes its default; "required" means you must give it.',
  columns: (name: string, type: string, byDefault: string, example: string, meaning: string) => `  ${name}  ${type}  ${byDefault}  ${example}  ${meaning}`,
  columnName: 'field',
  columnType: 'type',
  columnDefault: 'default',
  columnExample: 'what to put',
  columnMeaning: 'meaning',
  field: (name: string, type: string, byDefault: string, desc: string) => `  ${name}  ${type}  ${byDefault}  ${desc}`,
  required: 'required',
  scaled: (kind: string, scale: number) => `${kind} x${scale}`,
  choiceSeparator: ', ',
  leaveOut: 'leave it out',
  units: '  xN: you type game units and the wire value is N times larger. Prefix a value with raw: to send it as is.',
  groupHeading: '  then, repeated once per victim or projectile:',
  valuesLine: (message: string, fields: readonly string[]) => `  values: wire help ${message} <field>, for ${fields.join(', ')}`,
  fieldHeading: (message: string, field: string) => `${message} ${field}`,
  valueHeader: 'value',
  valueMeaning: 'what the game does',
  valueRow: (value: string, meaning: string) => `  ${value}  ${meaning}`,
  noTable: (field: string, values: string) => `  ${field} has no fixed values: ${values}`,
  about: ['What one message does, then its fields in send order: name, type (xN is the wire',
    'scale), the default when you leave it out, and what it means, then an example.',
    'With a field, the values that field takes and what the game does with each.'],
  see: ['wire', 'wire list'],
});

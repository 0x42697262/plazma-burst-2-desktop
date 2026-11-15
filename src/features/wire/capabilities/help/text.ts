import { DEFAULT_RULE as RULE, FIELD_KIND as KIND } from '../../keys.ts';

export const DEFAULT_WORDS: Readonly<Record<string, string>> = Object.freeze({
  [RULE.zero]: '0',
  [RULE.empty]: '(empty)',
  [RULE.aim]: 'aim',
  [RULE.area]: 'area',
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

export const HELP_TEXT = Object.freeze({
  usage: 'wire help <message>',
  desc: "Show what a message does, and each field's type, default and meaning",
  heading: (name: string, direction: string) => `${name}  (${direction})`,
  noteLine: (note: string) => `  note: ${note}`,
  description: (text: string) => `  ${text}`,
  setHint: '  Set a field as name=value, or give values in the order below. A field you leave out takes its default; "required" means you must give it.',
  columns: (name: string, type: string, byDefault: string, meaning: string) => `  ${name}  ${type}  ${byDefault}  ${meaning}`,
  columnName: 'field',
  columnType: 'type',
  columnDefault: 'default',
  columnMeaning: 'meaning',
  field: (name: string, type: string, byDefault: string, desc: string) => `  ${name}  ${type}  ${byDefault}  ${desc}`,
  required: 'required',
  scaled: (kind: string, scale: number) => `${kind} x${scale}`,
  choices: (choices: readonly string[]) => ` (${choices.join(', ')})`,
  units: '  xN: you type game units and the wire value is N times larger. Prefix a value with raw: to send it as is.',
  groupHeading: '  then, repeated once per victim or projectile:',
  about: ['What one message does, then its fields in send order: name, type (xN is the wire',
    'scale), the default when you leave it out, and what it means, then an example.'],
  see: ['wire', 'wire list'],
});

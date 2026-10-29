// "help" and the help renderers. All text comes from the command definitions (the
// registry) and the settings schema: nothing here lists commands or keys by hand.
import { print } from '../ui/log.js';
import { COLOR } from '../core/colors.js';
import { SCHEMA, ALIASES, resolveKey, aliasesOf, keyClientOnly, affectsGame, describeKey, showValue } from '../state/schema.js';
import { settings } from '../state/store.js';
import {
  findCommand, findSubcommand, findSubcommandAnywhere, helpEntries, findHelpEntry,
} from './registry.js';

const USAGE_WIDTH = 22; // the usage column in the overview
const ARG_WIDTH = 22; // the left column of "Arguments:"
const EXAMPLE_WIDTH = 38; // the left column of "Examples:"
const NEAR_SHOWN = 6;

export const CLIENT_TAG = ['  WARNING: client-only', COLOR.warn, true];
const clientOnlyLine = (reason) => print([[`  WARNING: client-only: ${reason}.`, COLOR.warn, true]]);

// Two columns while they fit on one line, otherwise the meaning underneath.
export function printPair(left, right, width) {
  const l = `  ${left}`;
  if (!right) { print(l, COLOR.bright); return; }
  if (l.length < width) { print([[l.padEnd(width + 1), COLOR.bright], [right, COLOR.hint]]); return; }
  print(l, COLOR.bright);
  print(`      ${right}`, COLOR.hint);
}

function printSections(h) {
  for (const line of h.about || []) print(`  ${line}`);
  if (h.args) {
    print('Arguments:', COLOR.title);
    for (const [a, what] of h.args) printPair(a, what, ARG_WIDTH);
  }
  if (h.examples) {
    print('Examples:', COLOR.title);
    for (const [c, what] of h.examples) printPair(c, what, EXAMPLE_WIDTH);
  }
  for (const line of h.notes || []) print([[`  ${line}`, COLOR.hint, true]]);
  if (h.see) print(`Related: ${h.see.join('  |  ')}`, COLOR.hint);
}

function printEntry(entry) {
  const { def, also } = entry;
  if (def.renderHelp) { def.renderHelp(); return; }
  print(def.usage, COLOR.title);
  print(`  ${def.desc}`);
  if (also.length) print(`  Also: ${also.join(', ')}`, COLOR.hint);
  if (typeof def.clientOnly === 'string') clientOnlyLine(def.clientOnly);
  printSections(def.help || {});
}

function printKeyHelp(key) {
  const sc = SCHEMA[key];
  const range = sc.type === 'bool' ? 'on / off' : sc.type === 'key' ? 'a key name (as in "bind"), or off'
    : `${sc.type === 'int' ? 'whole number' : 'number'}${sc.min === undefined ? '' : ` from ${sc.min} to ${sc.max}`}`;
  print(`${key} <value>`, COLOR.title);
  print(`  ${describeKey(key)}`);
  print(`  key in group ${sc.group}, ${range}${sc.default === undefined ? '' : `, default ${showValue(key, sc.default)}`}`, COLOR.hint);
  const set = settings.has(key);
  const from = settings.source(key);
  const via = from === 'yours' || from === 'default' ? '' : `  (profile ${from}${settings.hasOwn(key) ? `; yours: ${showValue(key, settings.own(key))}` : ''})`;
  print(`  now: ${set ? showValue(key, settings.get(key)) : 'default'}${via}`, set ? COLOR.ok : undefined);
  const also = aliasesOf(key);
  if (also.length) print(`  Also: ${also.join(', ')}`, COLOR.hint);
  const reason = keyClientOnly(key);
  if (reason) clientOnlyLine(reason);
  for (const line of sc.about || []) print(`  ${line}`);
  print('Examples:', COLOR.title);
  printPair(`${key} ${sc.type === 'bool' ? 'on' : sc.example || '<value>'}`, 'set it', EXAMPLE_WIDTH);
  if (sc.type === 'bool') printPair(key, 'toggle it', EXAMPLE_WIDTH);
  printPair(`unset ${key}`, 'back to the game default', EXAMPLE_WIDTH);
  if (affectsGame(key)) print([['  Applies while you are in a level.', COLOR.hint, true]]);
}

// "help <topic>": a command (any spelling), a subcommand ("triggers find", or the verb
// alone: "find"), or a key (any alias, or written as words: "hp bonus").
export function printTopicHelp(raw) {
  const words = raw.trim().toLowerCase().split(/\s+/);
  const cmd = findCommand(words[0]);
  let entry = null;
  if (cmd && cmd.subcommands.length && words[1]) {
    const sub = findSubcommand(cmd, words[1]);
    if (!sub) throw new Error(`no help for "${raw}". "help ${cmd.name}" lists what ${cmd.name} can do.`);
    entry = findHelpEntry(`${cmd.name} ${sub.name}`);
  } else if (words.length === 1 && !cmd) {
    const found = findSubcommandAnywhere(words[0]);
    if (found) entry = findHelpEntry(`${found.cmd.name} ${found.sub.name}`);
  }
  if (entry) { printEntry(entry); return; }
  // One word is a command first and a key second; several words are a key first.
  if (cmd && words.length === 1) { printEntry(findHelpEntry(cmd.name)); return; }
  const key = resolveKey(words.join('_')) || resolveKey(words[0]);
  if (key) { printKeyHelp(key); return; }
  if (cmd) { printEntry(findHelpEntry(cmd.name)); return; }
  const near = [...helpEntries().map((e) => e.id), ...Object.keys(SCHEMA), ...Object.keys(ALIASES)]
    .filter((n) => n.includes(words[0]) || words[0].includes(n)).slice(0, NEAR_SHOWN);
  throw new Error(`no help for "${raw}".${near.length ? ` Did you mean: ${near.join(', ')}?` : ''} Type "help" for everything.`);
}

const QUICK_EXAMPLES = Object.freeze([
  'Examples: god on | max_hp 500 | speed 1.8 | swords off | penetration 1 | unset speed',
  'Guns: guns | guns rail | give 12 | give gun_railgun 2',
]);

function printOverview() {
  print('Commands:', COLOR.title);
  for (const { def } of helpEntries()) {
    const line = [[`  ${def.usage.padEnd(USAGE_WIDTH)} ${def.desc}`]];
    if (typeof def.clientOnly === 'string') line.push(CLIENT_TAG);
    print(line);
  }
  const keys = Object.keys(SCHEMA);
  print('Keys (use "list" for values):', COLOR.title);
  print('  ' + keys.join(', '));
  print([[`  ${keys.filter(keyClientOnly).length} of ${keys.length} keys are client-only (see "list")`, COLOR.warn, true]]);
  print([['client-only = runs in your own game client, not through the server.', COLOR.warn, true]]);
  for (const line of QUICK_EXAMPLES) print(line, COLOR.hint);
  print('Overrides are saved to desktop/dev-overrides.json.', COLOR.hint);
  print('"help <command>" or "help <key>" explains one in full, e.g. "help triggers find".', COLOR.title);
}

export const helpCommand = {
  name: 'help',
  aliases: ['?'],
  usage: 'help [command | key]',
  desc: 'List every command and key, or explain one in full (also "<command> help")',
  handlesHelp: true,
  help: {
    about: [
      'With no topic: every command, every key, and a few examples.',
      'With a topic: everything known about one command or key.',
    ],
    examples: [
      ['help tp', 'the whole tp command'],
      ['help speed', 'what the speed key does, and its range'],
      ['help triggers find', 'the trigger search syntax'],
      ['tp help', 'the same as "help tp"'],
    ],
  },
  run: (args, { rest }) => (rest ? printTopicHelp(rest) : printOverview()),
};

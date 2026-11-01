// Settings commands: list, set, get, unset, reset, and a key typed as a command
// ("speed 1.8", "god").
import { print } from '../ui/log.js';
import { COLOR } from '../core/colors.js';
import { SCHEMA, GROUPS, KEY, resolveKey, parseValue, affectsGame, keyClientOnly, describeKey, showValue } from '../state/schema.js';
import { settings, binds, activeProfile, currentMap } from '../state/store.js';
import { showKey } from '../state/keys.js';
import { isActive } from '../game/level.js';
import { levelWasActive, gameMaxHp } from '../overrides/frame.js';
import { heldBack, refusal } from '../overrides/server-checks.js';
import { CLIENT_TAG } from './help.js';
import { REMOTE } from '../core/remote.js';
import { listSections } from '../../../../src/console/kernel/list-sections.ts';
import { editSummary } from '../editor/edit.js';
import { checksBypassed } from '../state/danger.js';

const RESET_WORDS = ['default', 'reset', 'unset'];
const KEY_WIDTH = 14;
const VALUE_WIDTH = 9;

const shown = (key) => (settings.has(key) ? showValue(key, settings.get(key)) : 'default');

// When the value in effect is a profile's: '[profile hardcore, yours: on]'.
export function sourceTag(key) {
  const from = settings.source(key);
  if (from === 'yours' || from === 'default') return '';
  return `[profile ${from}${settings.hasOwn(key) ? `, yours: ${showValue(key, settings.own(key))}` : ''}]`;
}

// After you change your value: say so when the map's profile still decides it.
function profileWins(key) {
  const from = settings.source(key);
  if (from === 'yours' || from === 'default') return;
  print(`  but profile "${from}" sets ${key} = ${showValue(key, settings.get(key))} on this map, which wins ("profile unset ${from} ${key}" to drop it)`, COLOR.warn);
}

function requireKey(word) {
  const key = resolveKey(word);
  if (!key) throw new Error(`unknown key "${word || ''}"`);
  return key;
}

export function setKey(key, raw) {
  const v = parseValue(key, raw);
  const why = heldBack(key, v, gameMaxHp());
  if (why) throw refusal(`${key} ${showValue(key, v)}`, why);
  settings.set(key, v);
  print(`${key} = ${showValue(key, v)}`, COLOR.ok);
  if (!levelWasActive() && affectsGame(key)) print('  (applies when you are in a level)', COLOR.hint);
  profileWins(key);
}

export function unsetKey(key, note = '') {
  settings.unset(key);
  print(`${key} = default${note}`, COLOR.ok);
  profileWins(key);
}

// A key typed as the command: alone it toggles a bool or shows a number, with
// "default" it goes back to the game's value, otherwise it sets it.
export function runKey(key, args) {
  const word = args[0];
  if (word === undefined) {
    const sc = SCHEMA[key];
    if (sc.type === 'bool') setKey(key, settings.has(key) ? !settings.get(key) : !sc.default);
    else print(`${key} = ${shown(key)}`);
  } else if (RESET_WORDS.includes(word.toLowerCase())) {
    unsetKey(key);
  } else {
    setKey(key, word);
  }
}

// What else you changed, after the keys: [title, rows] or null when there is nothing.
const EXTRAS = Object.freeze({
  checks: () => checksBypassed() && ['ranked match protection: OFF ("bypass checks")', ['  nothing is held back in ranked matches; "bypass off" turns it back on']],
  editor: () => {
    const sum = editSummary();
    if (!sum) return null;
    const parts = [['changed', sum.changed], ['added', sum.added], ['deleted', sum.deleted]].filter(([, n]) => n).map(([w, n]) => `${n} ${w}`);
    return [`editor: ${parts.join(', ')}`, [
      `  ${sum.inLevel ? 'in the running level' : 'kept, not in the running level'}; put in again when the level starts over on this map`,
      '  ("editor reset" undoes and forgets them)',
    ]];
  },
});
const allExtras = () => ({ ...EXTRAS, ...Object.fromEntries(listSections()) });
const LIST_GROUPS = () => [...GROUPS, ...Object.keys(allExtras())];

function listExtras(only) {
  for (const [name, make] of Object.entries(allExtras())) {
    if (only && name !== only) continue;
    const got = make();
    if (!got) { if (only) print(`[${name}] nothing`, COLOR.notice); continue; }
    print(`[${got[0]}]`, COLOR.title);
    for (const row of got[1]) print(row, COLOR.ok);
  }
}

function listKeys(group) {
  if (Object.hasOwn(allExtras(), group)) { listExtras(group); return; }
  const byGroup = new Map();
  for (const [k, sc] of Object.entries(SCHEMA)) {
    if (group && sc.group !== group) continue;
    if (!byGroup.has(sc.group)) byGroup.set(sc.group, []);
    byGroup.get(sc.group).push(k);
  }
  if (!byGroup.size) { print(`No group "${group}". Groups: ${LIST_GROUPS().join(', ')}`, COLOR.error); return; }
  for (const [g, keys] of byGroup) {
    print(`[${g}]`, COLOR.title);
    for (const k of keys) {
      const line = [[`  ${k.padEnd(KEY_WIDTH)} ${shown(k).padEnd(VALUE_WIDTH)} ${describeKey(k)}`, settings.has(k) ? COLOR.ok : undefined]];
      const tag = sourceTag(k);
      if (tag) line.push([`  ${tag}`, COLOR.warn, true]);
      if (keyClientOnly(k)) line.push(CLIENT_TAG);
      print(line);
    }
  }
  if (!group) listExtras();
}

export const settingsCommands = [
  {
    name: 'list',
    aliases: ['ls'],
    usage: 'list [group]',
    desc: `Show all keys and values, then binds, traces, logic view, zoom, editor edits,${REMOTE ? '' : ' hooks,'} changed vars`,
    help: {
      about: [
        'Every key with its current value and what it does. Keys you have set are',
        'green, the rest show "default". A value from this map\'s profile is tagged',
        '[profile <name>, yours: <value>]. After the keys, everything else you changed:',
        'key binds, traced players, the logic view, the map\'s profile, the zoom you set',
        `with "zoom", the map editor's edits,${REMOTE ? '' : ' the hooks that are loaded,'} and map variables`,
        'you set or removed with "vars" in this level (with the value before).',
      ],
      get args() { return [['[group]', `only this group: ${LIST_GROUPS().join(', ')}`]]; },
      examples: [
        ['list', 'all keys, then binds and the rest'],
        ['list bullets', 'just the bullet keys'],
        ['list vars', 'just the variables you changed'],
      ],
      see: ['set', 'get', 'unset', 'reset'],
    },
    run: (args) => listKeys(args[0]),
  },
  {
    name: 'set',
    usage: 'set <key> <value>',
    // "set screenshot_key ;": the value is a key name.
    keyArg: (words) => { const key = resolveKey(words[1]); return key && SCHEMA[key].type === 'key' ? 2 : undefined; },
    desc: 'Set an override (or just "<key> <value>")',
    // Client-only when the key is.
    clientOnly: (args) => { const key = resolveKey(args[0]); const reason = keyClientOnly(key); return reason && [key, reason]; },
    help: {
      about: [
        'The key name on its own works too, so "speed 1.8" is "set speed 1.8".',
      ],
      args: [
        ['<key>', 'a key name or one of its aliases (see "list")'],
        ['<value>', 'on/off/1/0 for a bool key, a number in range for the rest'],
      ],
      examples: [
        ['set speed 1.8', 'run 1.8x faster'],
        ['speed 1.8', 'the same, without "set"'],
        ['god', 'a bool key on its own toggles it'],
        ['speed default', 'the same as "unset speed"'],
      ],
      notes: [
        'Overrides are saved to desktop/dev-overrides.json and survive a restart.',
        'Keys outside the console and maps groups only apply while you are in a level.',
      ],
      see: ['list', 'get', 'unset', 'reset'],
    },
    run: (args) => {
      const key = requireKey(args[0]);
      if (args[1] === undefined) throw new Error(`usage: set ${key} <value>`);
      setKey(key, args[1]);
    },
  },
  {
    name: 'get',
    usage: 'get <key>',
    desc: 'Show one value',
    help: {
      args: [
        ['<key>', 'a key name or alias'],
      ],
      examples: [
        ['get speed', 'the value, or "default"'],
        ['speed', 'a number key on its own shows it too'],
      ],
      see: ['list', 'set'],
    },
    run: (args) => { const key = requireKey(args[0]); const tag = sourceTag(key); print(`${key} = ${shown(key)}${tag ? `  ${tag}` : ''}`); },
  },
  {
    name: 'unset',
    aliases: ['del', 'rm'],
    usage: 'unset <key>',
    desc: 'Remove an override (back to game default)',
    help: {
      about: [
        'Removes one override, so the game\'s own value is used again.',
      ],
      examples: [
        ['unset speed', 'back to the game default'],
        ['speed default', 'the same'],
      ],
      see: ['reset', 'set'],
    },
    run: (args) => unsetKey(requireKey(args[0])),
  },
  {
    name: 'reset',
    usage: 'reset',
    desc: 'Remove all overrides',
    help: {
      about: [
        'Removes every override at once. Key binds are kept: "unbind --all" clears those.',
        'Profiles are kept too: "profile" shows them.',
      ],
      see: ['unset', 'unbind'],
    },
    run: () => { settings.clear(); print('All overrides removed (binds and profiles kept; "unbind --all" removes binds)', COLOR.ok); },
  },
  {
    name: 'builtin',
    usage: 'builtin [on|off]',
    desc: 'Toggle silent built-in commands everywhere (see "get builtin")',
    help: {
      about: [
        'A key, so "builtin" toggles it and "builtin on" / "builtin off" set it.',
      ],
      see: ['game'],
    },
    run: (args) => runKey(KEY.BUILTIN, args),
  },
];

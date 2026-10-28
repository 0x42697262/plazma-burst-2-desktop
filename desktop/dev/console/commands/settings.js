// Settings commands: list, set, get, unset, reset, and a key typed as a command
// ("speed 1.8", "god").
import { print } from '../ui/log.js';
import { COLOR } from '../core/colors.js';
import { onOff } from '../core/text.js';
import { SCHEMA, GROUPS, KEY, resolveKey, parseValue, affectsGame, keyClientOnly, describeKey } from '../state/schema.js';
import { settings } from '../state/store.js';
import { levelWasActive } from '../overrides/frame.js';
import { CLIENT_TAG } from './help.js';

const RESET_WORDS = ['default', 'reset', 'unset'];
const KEY_WIDTH = 14;
const VALUE_WIDTH = 9;

const shown = (key) => (settings.has(key) ? onOff(settings.get(key)) : 'default');

function requireKey(word) {
  const key = resolveKey(word);
  if (!key) throw new Error(`unknown key "${word || ''}"`);
  return key;
}

export function setKey(key, raw) {
  const v = parseValue(key, raw);
  settings.set(key, v);
  print(`${key} = ${onOff(v)}`, COLOR.ok);
  if (!levelWasActive() && affectsGame(key)) print('  (applies when you are in a level)', COLOR.hint);
}

export function unsetKey(key, note = '') {
  settings.unset(key);
  print(`${key} = default${note}`, COLOR.ok);
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

function listKeys(group) {
  const byGroup = new Map();
  for (const [k, sc] of Object.entries(SCHEMA)) {
    if (group && sc.group !== group) continue;
    if (!byGroup.has(sc.group)) byGroup.set(sc.group, []);
    byGroup.get(sc.group).push(k);
  }
  if (!byGroup.size) { print(`No group "${group}". Groups: ${GROUPS.join(', ')}`, COLOR.error); return; }
  for (const [g, keys] of byGroup) {
    print(`[${g}]`, COLOR.title);
    for (const k of keys) {
      const line = [[`  ${k.padEnd(KEY_WIDTH)} ${shown(k).padEnd(VALUE_WIDTH)} ${describeKey(k)}`, settings.has(k) ? COLOR.ok : undefined]];
      if (keyClientOnly(k)) line.push(CLIENT_TAG);
      print(line);
    }
  }
}

export const settingsCommands = [
  {
    name: 'list',
    aliases: ['ls'],
    usage: 'list [group]',
    desc: 'Show all keys and current values',
    help: {
      about: [
        'Every key with its current value and what it does. Keys you have set are',
        'green, the rest show "default".',
      ],
      args: [
        ['[group]', 'only this group: player, world, bullets, gun, console, maps'],
      ],
      examples: [
        ['list', 'all keys'],
        ['list bullets', 'just the bullet keys'],
      ],
      see: ['set', 'get', 'unset', 'reset'],
    },
    run: (args) => listKeys(args[0]),
  },
  {
    name: 'set',
    usage: 'set <key> <value>',
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
    run: (args) => { const key = requireKey(args[0]); print(`${key} = ${shown(key)}`); },
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
        'Removes every override at once. Key binds are kept: "unbind all" clears those.',
      ],
      see: ['unset', 'unbind'],
    },
    run: () => { settings.clear(); print('All overrides removed (binds kept; "unbind all" removes them)', COLOR.ok); },
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

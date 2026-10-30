// Key binds: a key runs a console command in levels.
import { print } from '../ui/log.js';
import { COLOR } from '../core/colors.js';
import { plural } from '../core/text.js';
import { SCHEMA, ALIASES, unphrase } from '../state/schema.js';
import { parseKeyName, showKey, baseKey, GAME_KEYS } from '../state/keys.js';
import { binds, activeProfile } from '../state/store.js';
import { hotkeyOf } from '../state/hotkeys.js';
import { runWords } from './registry.js';
import { splitCommands } from '../dispatch.js';

const KEY_WIDTH = 16;

// Every first word a bound command may start with: commands and keys.
const canStart = (word) => {
  const w = word.toLowerCase();
  return runWords().includes(w) || Object.hasOwn(SCHEMA, w) || Object.hasOwn(ALIASES, w);
};

function listBinds() {
  const keys = binds.keys();
  const p = activeProfile();
  const mapKeys = p ? Object.keys(p.binds).sort() : [];
  if (!keys.length && !mapKeys.length) { print('No binds. Example: bind f tp', COLOR.notice); return; }
  if (keys.length) {
    print(`Binds (${keys.length}), active in levels while the console and chat are closed:`, COLOR.title);
    for (const k of keys) print(`  ${showKey(k).padEnd(KEY_WIDTH)} ${binds.get(k)}${mapKeys.includes(k) ? '  (not on this map: the profile\'s wins)' : ''}`);
  }
  if (mapKeys.length) {
    print(`On this map, profile "${p.name}" binds (${mapKeys.length}):`, COLOR.title);
    for (const k of mapKeys) print(`  ${showKey(k).padEnd(KEY_WIDTH)} ${p.binds[k]}`);
  }
}

export function bindKey(args) {
  if (!args.length) { listBinds(); return; }
  const key = parseKeyName(args[0]);
  const old = binds.get(key);
  if (args.length === 1) {
    print(old ? `${showKey(key)} = ${old}` : `${showKey(key)} is not bound`, old ? undefined : COLOR.notice);
    return;
  }
  const command = commandText(args.slice(1), 'usage: bind <key> <command>');
  binds.set(key, command);
  print(`${showKey(key)} = ${command}${old && old !== command ? `  (was: ${old})` : ''}`, COLOR.ok);
  const now = binds.active(key);
  if (now && now.profile) print(`  but profile "${now.profile}" binds ${showKey(key)} on this map, which wins there`, COLOR.warn);
  warnKeyUses(key);
}

// The command a bind (or a profile's onload) runs, from the words typed. Quotes let it
// hold a ";" chain: bind f "vars set x 1; vars sync x r". Each command of the chain is
// checked the way it will run: split at ";", phrases turned into keys ("fast load maps
// on" is fast_maps).
export function commandText(words, usage) {
  const command = words.join(' ').replace(/^"([\s\S]*)"$/, '$1').trim();
  const parts = splitCommands(command);
  if (!parts.length) throw new Error(usage);
  for (const part of parts) {
    const first = unphrase(part).split(/\s+/)[0];
    if (!canStart(first)) throw new Error(`unknown command "${first}"${part !== first ? ` in "${part}"` : ''}. Type "help".`);
  }
  return command;
}

// What else the key does: a hotkey (screenshot, editor), a game key.
export function warnKeyUses(key) {
  const hot = hotkeyOf(key);
  if (hot) {
    print(`  ${showKey(key)} is ${hot.what}, which wins: "${hot.key} <other key>" or "${hot.key} off" frees it.`, COLOR.warn);
  }
  const base = baseKey(key);
  if (GAME_KEYS[base] !== undefined) {
    print(`  ${showKey(key)} is also a game key (${base === key ? '' : showKey(base) + ': '}${GAME_KEYS[base]}). In levels the bind runs instead.`, COLOR.warn);
  }
}

export function unbindKey(args) {
  if (args.length !== 1) throw new Error('usage: unbind <key>  |  unbind --all');
  if (['all', '--all'].includes(args[0].toLowerCase())) {
    print(`Removed ${plural(binds.clear(), 'bind')}`, COLOR.ok);
    return;
  }
  const key = parseKeyName(args[0]);
  const old = binds.get(key);
  if (!old) { print(`${showKey(key)} is not bound`, COLOR.notice); return; }
  print(`Unbound ${showKey(key)} (was: ${old})`, COLOR.ok);
  binds.remove(key);
}

export const bindCommands = [
  {
    name: 'bind',
    aliases: ['binds'],
    usage: 'bind <key> <command>',
    keyArg: 1,
    desc: 'Run a command with a key in levels, e.g. "bind f tp", "bind shift+h heal". "bind" lists binds',
    help: {
      about: [
        'Binds run in levels while the console and the game chat are both closed.',
        '"bind" alone lists every bind; "bind <key>" shows just that one.',
      ],
      args: [
        ['<key>', 'a key name, e.g. f, shift+h, ctrl+alt+3'],
        ['<command>', 'any console command, arguments included'],
      ],
      examples: [
        ['bind f tp', 'teleport to the crosshair with F'],
        ['bind shift+h heal', 'refill HP'],
        ['bind 5 give gun_railgun', 'a gun on a number key'],
        ['bind f "heal; pos"', 'several commands: quote them, or the ";" ends the bind'],
        ['bind ; heal', 'the ";" key itself (also "semicolon", "shift+;")'],
        ['bind > heal', 'Shift and the "." key: shift+period'],
        ['binds', 'list them all'],
      ],
      notes: [
        'Keys are named by their physical key, so shift+1 is "shift+1"; typing "!" means the',
        'same (shifted characters are read with the US layout). "keyname" shows any key\'s name.',
        'Binding a key the game already uses wins in levels; the console says so.',
        'Binds live in dev-overrides.json and survive "reset".',
      ],
      see: ['unbind', 'keyname'],
    },
    run: bindKey,
  },
  {
    name: 'unbind',
    usage: 'unbind <key> | --all',
    keyArg: 1,
    desc: 'Remove a key bind',
    help: {
      args: [
        ['<key>', 'remove that one bind'],
        ['--all', 'remove every bind ("all" works too)'],
      ],
      see: ['bind'],
    },
    run: unbindKey,
  },
];

// Key binds: a key runs a console command in levels.
import { print } from '../ui/log.js';
import { COLOR } from '../core/colors.js';
import { plural } from '../core/text.js';
import { SCHEMA, ALIASES, KEY, unphrase } from '../state/schema.js';
import { parseKeyName, showKey, baseKey, GAME_KEYS } from '../state/keys.js';
import { binds, settings } from '../state/store.js';
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
  if (!keys.length) { print('No binds. Example: bind f tp', COLOR.notice); return; }
  print(`Binds (${keys.length}), active in levels while the console and chat are closed:`, COLOR.title);
  for (const k of keys) print(`  ${showKey(k).padEnd(KEY_WIDTH)} ${binds.get(k)}`);
}

export function bindKey(args) {
  if (!args.length) { listBinds(); return; }
  const key = parseKeyName(args[0]);
  const old = binds.get(key);
  if (args.length === 1) {
    print(old ? `${showKey(key)} = ${old}` : `${showKey(key)} is not bound`, old ? undefined : COLOR.notice);
    return;
  }
  // Quotes let a bind hold a ";" chain: bind f "vars set x 1; vars sync x r".
  const command = args.slice(1).join(' ').replace(/^"([\s\S]*)"$/, '$1');
  // Each command of the chain is checked the way it will run: split at ";", phrases
  // turned into keys ("fast load maps on" is fast_maps).
  const parts = splitCommands(command);
  if (!parts.length) throw new Error('usage: bind <key> <command>');
  for (const part of parts) {
    const first = unphrase(part).split(/\s+/)[0];
    if (!canStart(first)) throw new Error(`unknown command "${first}"${part !== first ? ` in "${part}"` : ''}. Type "help".`);
  }
  binds.set(key, command);
  print(`${showKey(key)} = ${command}${old && old !== command ? `  (was: ${old})` : ''}`, COLOR.ok);
  if (settings.effective(KEY.SCREENSHOT_KEY) === key) {
    print(`  ${showKey(key)} is the screenshot key, which wins: "screenshot_key <other key>" or "screenshot_key off" frees it.`, COLOR.warn);
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
        ['binds', 'list them all'],
      ],
      notes: [
        'Keys are named by their physical key, so shift+1 is "shift+1", not "shift+!".',
        'Binding a key the game already uses wins in levels; the console says so.',
        'Binds live in dev-overrides.json and survive "reset".',
      ],
      see: ['unbind'],
    },
    run: bindKey,
  },
  {
    name: 'unbind',
    usage: 'unbind <key> | --all',
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

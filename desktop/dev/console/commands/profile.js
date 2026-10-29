// "profile": settings for some maps. A profile is a set of game keys ("hardcore": god
// off, speed 1); a map uses one, and on that map its values win over yours. Profiles can
// also be written by hand in dev-overrides.json ("profiles" and "maps").
import { print } from '../ui/log.js';
import { COLOR } from '../core/colors.js';
import { plural } from '../core/text.js';
import { SCHEMA, resolveKey, parseValue, affectsGame, showValue } from '../state/schema.js';
import { settings, profiles, activeProfile, currentMap } from '../state/store.js';
import { parseKeyName, showKey } from '../state/keys.js';
import { isActive } from '../game/level.js';
import { commandText, warnKeyUses } from './binds.js';
import { run } from '../dispatch.js';

const KEY_WIDTH = 14;
const NAME_WIDTH = 16;
const NONE = 'none';

const requireMap = () => {
  const id = currentMap();
  if (!id) throw new Error('no map loaded yet: start one, or name it ("profile use <name> <map id>")');
  return id;
};

function requireProfile(name) {
  if (!name) throw new Error('which profile? "profile list" shows them');
  if (!profiles.exists(name)) throw new Error(`no profile "${name}". "profile list" shows them.`);
  return name;
}

function requireGameKey(word) {
  const key = resolveKey(word);
  if (!key) throw new Error(`unknown key "${word || ''}"`);
  if (!affectsGame(key)) throw new Error(`${key} is a console key: it is the same on every map, so a profile cannot set it`);
  return key;
}

// "god off, speed 2, 1 bind, onload"
const summary = (p) => {
  const keys = Object.keys(p.values).sort();
  const parts = keys.map((k) => `${k} ${showValue(k, p.values[k])}`);
  const nBinds = Object.keys(p.binds).length;
  if (nBinds) parts.push(plural(nBinds, 'bind'));
  if (p.onload) parts.push('onload');
  return parts.length ? parts.join(', ') : 'nothing yet';
};

// A profile's settings (each with yours beside it), binds and onload.
function printProfile(p) {
  const keys = Object.keys(p.values).sort();
  const bindKeys = Object.keys(p.binds).sort();
  if (!keys.length && !bindKeys.length && !p.onload) {
    print('  sets nothing yet: "profile set", "profile bind" or "profile onload" (see "help profile")', COLOR.notice);
    return;
  }
  for (const k of keys) {
    const yours = settings.hasOwn(k) ? showValue(k, settings.own(k)) : 'default';
    print([[`  ${k.padEnd(KEY_WIDTH)} ${showValue(k, p.values[k]).padEnd(9)}`, COLOR.ok], [`  yours: ${yours}`, COLOR.hint, true]]);
  }
  for (const k of bindKeys) print([[`  bind ${showKey(k).padEnd(KEY_WIDTH - 5)} ${p.binds[k]}`, COLOR.ok]]);
  if (p.onload) print([['  onload         ', COLOR.ok], [p.onload, COLOR.ok]]);
}

// ----- profile -----

function status() {
  const id = currentMap();
  if (!id) { print('No map loaded yet. Profiles apply on the maps that use them ("profile list").', COLOR.notice); return; }
  const p = activeProfile();
  if (!p) {
    print(`Map ${id}: no profile, your settings apply. "profile use <name>" gives it one.`, COLOR.notice);
    return;
  }
  print(`Map ${id} uses profile "${p.name}", which wins over your settings and binds here:`, COLOR.title);
  printProfile(p);
}

// ----- profile list | show -----

function list() {
  const names = profiles.names();
  if (!names.length) { print('No profiles. "profile use <name>" makes one for this map.', COLOR.notice); return; }
  const active = activeProfile();
  print(`Profiles: ${names.length}`, COLOR.title);
  for (const name of names) {
    const maps = profiles.mapsUsing(name);
    const mark = active && active.name === name ? '  (this map)' : '';
    print([[`  ${name.padEnd(NAME_WIDTH)} ${summary(profiles.get(name))}`, active && active.name === name ? COLOR.ok : undefined],
      [`  maps: ${maps.length ? maps.join(', ') : 'none'}${mark}`, COLOR.hint, true]]);
  }
}

function show(args) {
  const name = requireProfile(args[0]);
  const maps = profiles.mapsUsing(name);
  print(`Profile "${name}", used by ${maps.length ? `map${maps.length === 1 ? '' : 's'} ${maps.join(', ')}` : 'no map'}:`, COLOR.title);
  printProfile(profiles.get(name));
}

// ----- profile use <name | none> [map id] -----

function use(args) {
  if (!args.length || args.length > 2) throw new Error('usage: profile use <name | none> [map id]');
  const [name, given] = args;
  const id = given || requireMap();
  const was = profiles.of(id);
  if (name.toLowerCase() === NONE) {
    profiles.use(id, null);
    print(was ? `Map ${id}: no profile (was "${was}"), your settings apply` : `Map ${id} had no profile`, was ? COLOR.ok : COLOR.notice);
    return;
  }
  const isNew = !profiles.exists(name);
  profiles.use(id, name);
  print(`Map ${id} uses profile "${name}"${isNew ? ' (new)' : ''}${was && was !== name ? `, was "${was}"` : ''}: ${summary(profiles.get(name))}`, COLOR.ok);
  if (isNew) print(`  "profile set ${name} <key> <value>" fills it, e.g. "profile set ${name} god off"`, COLOR.hint);
}

// ----- profile set | unset | delete -----

function setValue(args) {
  if (args.length !== 3) throw new Error('usage: profile set <name> <key> <value>');
  const [name, word, raw] = args;
  if (name.toLowerCase() === NONE) throw new Error('"none" means no profile; pick another name');
  const key = requireGameKey(word);
  const v = parseValue(key, raw);
  const isNew = !profiles.exists(name);
  profiles.set(name, key, v);
  print(`${name}: ${key} = ${showValue(key, v)}${isNew ? ' (new profile: "profile use ' + name + '" puts it on this map)' : ''}`, COLOR.ok);
}

function unsetValue(args) {
  if (args.length !== 2) throw new Error('usage: profile unset <name> <key>');
  const name = requireProfile(args[0]);
  const key = requireGameKey(args[1]);
  if (!Object.hasOwn(profiles.get(name).values, key)) { print(`${name} does not set ${key}`, COLOR.notice); return; }
  profiles.unset(name, key);
  print(`${name}: ${key} removed, your setting applies on its maps`, COLOR.ok);
}

// ----- profile bind | unbind | onload -----

function bind(args) {
  const usage = 'usage: profile bind <name> <key> <command>';
  if (args.length < 2) throw new Error(usage);
  const [name, word] = args;
  if (name.toLowerCase() === NONE) throw new Error('"none" means no profile; pick another name');
  const key = parseKeyName(word);
  const old = profiles.exists(name) ? profiles.get(name).binds[key] : undefined;
  if (args.length === 2) {
    print(old ? `${name}: ${showKey(key)} = ${old}` : `${name} does not bind ${showKey(key)}`, old ? undefined : COLOR.notice);
    return;
  }
  const command = commandText(args.slice(2), usage);
  profiles.bind(name, key, command);
  print(`${name}: ${showKey(key)} = ${command}${old && old !== command ? `  (was: ${old})` : ''}`, COLOR.ok);
  print(`  on maps using "${name}"${profiles.mapsUsing(name).length ? ` (${profiles.mapsUsing(name).join(', ')})` : ': none yet, "profile use ' + name + '"'}; it wins over your own ${showKey(key)} bind there`, COLOR.hint);
  warnKeyUses(key);
}

function unbind(args) {
  if (args.length !== 2) throw new Error('usage: profile unbind <name> <key>');
  const name = requireProfile(args[0]);
  const key = parseKeyName(args[1]);
  const old = profiles.get(name).binds[key];
  if (!old) { print(`${name} does not bind ${showKey(key)}`, COLOR.notice); return; }
  profiles.unbind(name, key);
  print(`${name}: unbound ${showKey(key)} (was: ${old}); your own bind for it applies on its maps`, COLOR.ok);
}

const CLEAR = '--clear';

function onload(args) {
  const usage = 'usage: profile onload <name> <command>  |  profile onload <name> --clear';
  if (!args.length) throw new Error(usage);
  const [name, ...rest] = args;
  if (name.toLowerCase() === NONE) throw new Error('"none" means no profile; pick another name');
  if (!rest.length) {
    const now = profiles.exists(name) && profiles.get(name).onload;
    print(now ? `${name} onload: ${now}` : `${name} runs nothing on load`, now ? undefined : COLOR.notice);
    return;
  }
  if (rest.length === 1 && rest[0].toLowerCase() === CLEAR) {
    requireProfile(name);
    profiles.setOnload(name, '');
    print(`${name}: runs nothing on load now`, COLOR.ok);
    return;
  }
  const command = commandText(rest, usage);
  profiles.setOnload(name, command);
  print(`${name} onload: ${command}`, COLOR.ok);
  print(`  runs each time a level starts on a map using "${name}"`, COLOR.hint);
}

function remove(args) {
  if (args.length !== 1) throw new Error('usage: profile delete <name>');
  const name = requireProfile(args[0]);
  const maps = profiles.remove(name);
  print(`Deleted profile "${name}"${maps.length ? `; ${plural(maps.length, 'map')} no longer use it: ${maps.join(', ')}` : ''}`, COLOR.ok);
}

// Says so when the map or its profile changes: on joining a map with a profile, and on
// leaving one for a map without. Runs the profile's onload as a level on its map starts.
let lastSeen = '';
let wasActive = false;
export function profileTick() {
  const id = currentMap();
  const p = activeProfile();
  const now = `${id}|${p ? p.name : ''}`;
  if (now !== lastSeen) {
    const hadProfile = lastSeen.split('|')[1];
    lastSeen = now;
    if (p) print(`Map ${id} uses profile "${p.name}": ${summary(p)}`, COLOR.hint);
    else if (hadProfile && id) print(`Map ${id}: no profile, your settings apply`, COLOR.hint);
  }
  const active = isActive();
  const started = active && !wasActive;
  wasActive = active;
  if (started && p && p.onload) run(p.onload, `profile ${p.name} onload`);
}

const GAME_KEY_GROUPS = [...new Set(Object.entries(SCHEMA).filter(([k]) => affectsGame(k)).map(([, s]) => s.group))];

export const profileCommand = {
  name: 'profile',
  aliases: ['profiles'],
  usage: 'profile [list | show | use | set | unset | bind | unbind | onload | delete] ...',
  desc: 'Settings, binds and start-up commands for some maps: a profile used by a map wins over yours there',
  help: {
    about: [
      'A profile holds settings (god, speed... the names "list" shows), key binds, and',
      'commands to run as a level starts ("onload"). A map uses one profile, and on that',
      'map its settings and binds win over yours; whatever it does not set is yours as',
      'usual. Several maps can use the same profile, so one change applies to all.',
      'A map is the match\'s map in multiplayer, otherwise the map loaded last: a',
      'campaign level ("c31a") or the custom map ID you typed.',
      `Profile settings are game keys only (${GAME_KEY_GROUPS.join(', ')}), not console keys.`,
    ],
    args: [
      ['(nothing)', 'this map: its profile and what it sets'],
      ['list', 'every profile and the maps that use it'],
      ['show <name>', 'one profile'],
      ['use <name> [map id]', 'this map (or that one) uses it; a new name makes an empty profile'],
      ['use none [map id]', 'this map uses no profile'],
      ['set <name> <setting> <value>', 'a setting in a profile (makes the profile if new)'],
      ['unset <name> <setting>', 'remove a setting from a profile'],
      ['bind <name> <key> <command>', 'a key bind for its maps, like "bind"; wins over yours there'],
      ['unbind <name> <key>', 'remove a profile bind'],
      ['onload <name> <command>', 'run this as a level starts on its maps; --clear removes it'],
      ['delete <name>', 'the profile, and every map\'s use of it'],
    ],
    examples: [
      ['profile use hardcore', 'this map uses "hardcore"'],
      ['profile set hardcore god off', 'no god mode on its maps, even with "god on"'],
      ['profile use fun local-arena', 'map local-arena uses "fun"'],
      ['profile bind paulbase shift+j "vars set x 1; vars sync x r"', 'Shift+J on paulbase\'s maps only'],
      ['profile onload paulbase "vars set name_color \\"#78dbe2\\"; vars sync name_color r"', 'every time a level on them starts'],
      ['list', 'values from the profile are tagged [profile hardcore, yours: on]'],
    ],
    notes: [
      'In desktop/dev-overrides.json: "profiles": { "hardcore": { "god": false, "binds":',
      '{ "shift+j": "heal" }, "onload": "heal; pos" } } and "maps": { "<map id>": "hardcore" }.',
      '"onload" may also be a list of commands. Saving the file while the game runs reloads',
      'it, and anything wrong in it (an unknown key, a value out of range) is printed here.',
      'Onload runs each time a level starts: joining a match, or restarting a level.',
    ],
    see: ['list', 'set'],
  },
  run: status,
  subcommands: [
    { name: 'list', aliases: ['ls'], usage: 'profile list', desc: 'Every profile and the maps that use it', help: { see: ['profile'] }, run: list },
    { name: 'show', usage: 'profile show <name>', desc: 'One profile\'s keys, with yours beside them', help: { see: ['profile list'] }, run: show },
    {
      name: 'use', usage: 'profile use <name | none> [map id]', desc: 'This map (or that one) uses a profile, or none',
      help: { about: ['A new name makes an empty profile. Without a map ID, the current map.'], see: ['profile set'] },
      run: use,
    },
    { name: 'set', usage: 'profile set <name> <setting> <value>', desc: 'Set a setting (god, speed... see "list") in a profile', help: { see: ['profile unset', 'set'] }, run: setValue },
    { name: 'unset', aliases: ['rm', 'del'], usage: 'profile unset <name> <setting>', desc: 'Remove a setting from a profile', help: { see: ['profile set'] }, run: unsetValue },
    {
      name: 'bind', usage: 'profile bind <name> <key> [command]', desc: 'A key bind on the profile\'s maps only; wins over your bind there',
      keyArg: 3,
      help: { about: ['Like "bind", for the maps using the profile. Without a command, shows it.'], see: ['profile unbind', 'bind'] },
      run: bind,
    },
    { name: 'unbind', usage: 'profile unbind <name> <key>', desc: 'Remove a profile bind', keyArg: 3, help: { see: ['profile bind'] }, run: unbind },
    {
      name: 'onload', aliases: ['autorun', 'onjoin'], usage: 'profile onload <name> [command | --clear]',
      desc: 'Commands to run each time a level starts on the profile\'s maps',
      help: {
        about: ['Without a command, shows it. Quote a ";" chain, as with "bind".',
          'Runs as the level starts: joining a match, or starting or restarting the level.'],
        see: ['profile bind'],
      },
      run: onload,
    },
    { name: 'delete', aliases: ['remove'], usage: 'profile delete <name>', desc: 'Delete a profile; its maps use none', help: { see: ['profile use'] }, run: remove },
  ],
};

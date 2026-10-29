// "profile": settings for some maps. A profile is a set of game keys ("hardcore": god
// off, speed 1); a map uses one, and on that map its values win over yours. Profiles can
// also be written by hand in dev-overrides.json ("profiles" and "maps").
import { print } from '../ui/log.js';
import { COLOR } from '../core/colors.js';
import { plural } from '../core/text.js';
import { SCHEMA, resolveKey, parseValue, affectsGame, showValue } from '../state/schema.js';
import { settings, profiles, activeProfile, currentMap } from '../state/store.js';

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

const summary = (vals) => {
  const keys = Object.keys(vals).sort();
  return keys.length ? keys.map((k) => `${k} ${showValue(k, vals[k])}`).join(', ') : 'nothing yet';
};

// The keys of a profile, each with yours beside it.
function printValues(vals) {
  const keys = Object.keys(vals).sort();
  if (!keys.length) { print('  sets nothing yet: "profile set <name> <key> <value>"', COLOR.notice); return; }
  for (const k of keys) {
    const yours = settings.hasOwn(k) ? showValue(k, settings.own(k)) : 'default';
    print([[`  ${k.padEnd(KEY_WIDTH)} ${showValue(k, vals[k]).padEnd(9)}`, COLOR.ok], [`  yours: ${yours}`, COLOR.hint, true]]);
  }
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
  print(`Map ${id} uses profile "${p.name}", which wins over your settings here:`, COLOR.title);
  printValues(p.values);
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
  printValues(profiles.get(name));
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
  if (!Object.hasOwn(profiles.get(name), key)) { print(`${name} does not set ${key}`, COLOR.notice); return; }
  profiles.unset(name, key);
  print(`${name}: ${key} removed, your setting applies on its maps`, COLOR.ok);
}

function remove(args) {
  if (args.length !== 1) throw new Error('usage: profile delete <name>');
  const name = requireProfile(args[0]);
  const maps = profiles.remove(name);
  print(`Deleted profile "${name}"${maps.length ? `; ${plural(maps.length, 'map')} no longer use it: ${maps.join(', ')}` : ''}`, COLOR.ok);
}

// Says so when the map or its profile changes: on joining a map with a profile, and on
// leaving one for a map without.
let lastSeen = '';
export function profileTick() {
  const id = currentMap();
  const p = activeProfile();
  const now = `${id}|${p ? p.name : ''}`;
  if (now === lastSeen) return;
  const hadProfile = lastSeen.split('|')[1];
  lastSeen = now;
  if (p) print(`Map ${id} uses profile "${p.name}": ${summary(p.values)}`, COLOR.hint);
  else if (hadProfile && id) print(`Map ${id}: no profile, your settings apply`, COLOR.hint);
}

const GAME_KEY_GROUPS = [...new Set(Object.entries(SCHEMA).filter(([k]) => affectsGame(k)).map(([, s]) => s.group))];

export const profileCommand = {
  name: 'profile',
  aliases: ['profiles'],
  usage: 'profile [list | show <name> | use <name | none> [map id] | set <name> <key> <value> | unset <name> <key> | delete <name>]',
  desc: 'Settings for some maps: a profile ("hardcore": god off) used by a map wins over yours there',
  help: {
    about: [
      'A profile is a set of game keys. A map uses one profile, and on that map its',
      'values win over yours; keys it does not set are yours as usual. Several maps can',
      'use the same profile, so one change applies to all of them.',
      'A map is the match\'s map in multiplayer, otherwise the map loaded last: a',
      'campaign level ("c31a") or the custom map ID you typed.',
      `Profiles hold game keys only (${GAME_KEY_GROUPS.join(', ')}), not console keys.`,
    ],
    args: [
      ['(nothing)', 'this map: its profile and what it sets'],
      ['list', 'every profile and the maps that use it'],
      ['show <name>', 'one profile'],
      ['use <name> [map id]', 'this map (or that one) uses it; a new name makes an empty profile'],
      ['use none [map id]', 'this map uses no profile'],
      ['set <name> <key> <value>', 'a key in a profile (makes the profile if new)'],
      ['unset <name> <key>', 'remove a key from a profile'],
      ['delete <name>', 'the profile, and every map\'s use of it'],
    ],
    examples: [
      ['profile use hardcore', 'this map uses "hardcore"'],
      ['profile set hardcore god off', 'no god mode on its maps, even with "god on"'],
      ['profile use fun local-arena', 'map local-arena uses "fun"'],
      ['list', 'values from the profile are tagged [profile hardcore, yours: on]'],
    ],
    notes: [
      'In desktop/dev-overrides.json: "profiles": { "hardcore": { "god": false } } and',
      '"maps": { "<map id>": "hardcore" }. Saving the file while the game runs reloads it,',
      'and anything wrong in it (an unknown key, a value out of range) is printed here.',
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
    { name: 'set', usage: 'profile set <name> <key> <value>', desc: 'Set a game key in a profile', help: { see: ['profile unset', 'set'] }, run: setValue },
    { name: 'unset', aliases: ['rm', 'del'], usage: 'profile unset <name> <key>', desc: 'Remove a key from a profile', help: { see: ['profile set'] }, run: unsetValue },
    { name: 'delete', aliases: ['remove'], usage: 'profile delete <name>', desc: 'Delete a profile; its maps use none', help: { see: ['profile use'] }, run: remove },
  ],
};

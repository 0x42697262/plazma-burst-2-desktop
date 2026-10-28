// The console's settings ("keys"): what each one is, how it is typed, and what it takes.
// This table is the only place a key is defined; KEY gives every other module its name.
import { onOff } from '../core/text.js';
import { PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX } from '../core/limits.js';

// Groups that only configure the console itself: they need no level and are not
// client-only. Every other group changes your own game client.
export const GROUP = Object.freeze({
  player: 'player', world: 'world', bullets: 'bullets', gun: 'gun', console: 'console', maps: 'maps',
});
const CONSOLE_GROUPS = new Set([GROUP.console, GROUP.maps]);

export const CLIENT_ONLY_REASON = 'it runs in your game client only, not through the server';

// type: bool | number | int. default: shown in help, and what a bare bool key toggles
// from. example: a value for help. phrases: other ways to type the key's name.
export const SCHEMA = Object.freeze({
  god: { type: 'bool', group: GROUP.player, desc: 'Ignore all damage' },
  max_hp: {
    type: 'number', group: GROUP.player, min: 1, max: 1e9, desc: 'Force max HP (refills HP when changed)',
    about: ['Refills your HP whenever you change it. "hp 500" sets this key.'], example: '500',
  },
  hp_bonus: {
    type: 'number', group: GROUP.player, min: -1e9, max: 1e9,
    desc: 'Added to max HP once per life/level, never stacks ("hp +100" / "hp -100")',
    about: ['Added once per life and per level, so it never stacks. "hp +100" sets this.'], example: '100',
  },
  hp_bonus_pct: {
    type: 'number', group: GROUP.player, min: -100, max: 1e6,
    desc: 'Percent of the game\'s max HP added once per life/level ("hp +50%" / "hp -25%")',
    about: ['A percentage of the game\'s own max, added once per life and per level.', '"hp +50%" sets this.'],
    example: '50',
  },
  speed: { type: 'number', group: GROUP.player, min: 0.1, max: 10, desc: 'Run speed multiplier, 1 = normal', example: '1.8' },
  jump: { type: 'number', group: GROUP.player, min: 0, max: 20, desc: 'Jump strength multiplier, 1 = normal', example: '2' },
  gravity: { type: 'bool', group: GROUP.player, desc: 'Player gravity on/off' },
  fly: {
    type: 'bool', group: GROUP.player, desc: 'Fly with jump/crouch keys (turns gravity off)',
    about: ['Fly with the jump and crouch keys. Turns gravity off while it is on.'],
  },
  fly_speed: { type: 'number', group: GROUP.player, min: 0.5, max: 50, default: 6, desc: 'Vertical fly speed', example: '10' },
  swords: { type: 'bool', group: GROUP.player, desc: 'Your swords on/off (other characters unaffected)' },
  world_gravity: {
    type: 'number', group: GROUP.world, min: -5, max: 5, desc: 'Gravity for everything (map default is usually 0.5)',
    about: ['Applies to everything, not just you. Most maps use 0.5.'], example: '0.2',
  },
  bullet_damage: { type: 'number', group: GROUP.bullets, min: 0, max: 1000, desc: 'Damage multiplier for your bullets', example: '5' },
  bullet_speed: { type: 'number', group: GROUP.bullets, min: 0.05, max: 20, desc: 'Speed multiplier for your bullets' },
  bullet_life: { type: 'number', group: GROUP.bullets, min: 0.05, max: 50, desc: 'Lifetime/range multiplier for your bullets' },
  penetration: {
    type: 'number', group: GROUP.bullets, min: 0, max: 1, desc: 'Damage kept per hit: 0 = game default (30%), 1 = no loss',
    about: ['How much damage a bullet keeps after each hit it passes through.'], example: '1',
  },
  fire_rate: { type: 'number', group: GROUP.gun, min: 0.05, max: 20, desc: 'Fire-rate multiplier for held gun' },
  pellets: { type: 'int', group: GROUP.gun, min: 1, max: 50, desc: 'Projectiles per shot for held gun' },
  spread: {
    type: 'number', group: GROUP.gun, min: 0, max: 10, desc: 'Spread multiplier, 0 = perfectly accurate',
    about: ['0 makes the held gun perfectly accurate.'], example: '0',
  },
  recoil: { type: 'number', group: GROUP.gun, min: 0, max: 10, desc: 'Recoil multiplier for held gun' },
  builtin: { type: 'bool', group: GROUP.console, desc: 'game <cmd>: on = silent, works on any map and in multiplayer; off = normal game chat' },
  trigger_history: {
    type: 'bool', group: GROUP.console, default: true, desc: 'Record trigger runs for "triggers history"',
    about: ['Turns the recording for "triggers history" on and off.'],
  },
  page_size: {
    type: 'int', group: GROUP.console, min: 10, max: PAGE_SIZE_MAX, default: PAGE_SIZE_DEFAULT,
    desc: 'Lines per page for long lists like "triggers"; "more" = next page',
    about: [`Lines per page for "triggers" and the other long lists. The default (${PAGE_SIZE_DEFAULT})`,
      'keeps a whole page inside this log.'],
    example: '50',
  },
  save_maps: {
    type: 'bool', group: GROUP.maps, default: true,
    desc: 'Save every map the game downloads to desktop/maps/<map id>.xml, uncompressed and one tag per line',
    about: ['Every map the game downloads is written to desktop/maps/<map id>.xml,', 'uncompressed and one XML tag per line.'],
    phrases: [/^save\s+maps?(?=\s|$)/i],
  },
  fast_maps: {
    type: 'bool', group: GROUP.maps, default: false,
    desc: 'Fast load: use the saved map from desktop/maps instead of downloading it again',
    about: ['Loads the saved copy from desktop/maps instead of downloading the map',
      'again. Single-player maps are served by the desktop wrapper; multiplayer maps',
      'are handed to the game as it joins a match.'],
    phrases: [/^fast\s+load(\s+maps?)?(?=\s|$)/i],
  },
});

// KEY.MAX_HP === 'max_hp'. Reading a key that does not exist throws, so a typo fails
// loudly instead of silently matching nothing.
export const KEY = new Proxy(
  Object.freeze(Object.fromEntries(Object.keys(SCHEMA).map((k) => [k.toUpperCase(), k]))),
  { get(keys, name) { if (!(name in keys)) throw new Error(`no setting ${String(name)}`); return keys[name]; } },
);

export const ALIASES = Object.freeze({
  hp: KEY.MAX_HP, maxhp: KEY.MAX_HP, health: KEY.MAX_HP, godmode: KEY.GOD,
  grav: KEY.GRAVITY, wgrav: KEY.WORLD_GRAVITY, pen: KEY.PENETRATION, pierce: KEY.PENETRATION,
  dmg: KEY.BULLET_DAMAGE, damage: KEY.BULLET_DAMAGE, bspeed: KEY.BULLET_SPEED, range: KEY.BULLET_LIFE,
  rate: KEY.FIRE_RATE, firerate: KEY.FIRE_RATE, accuracy: KEY.SPREAD, jumps: KEY.JUMP,
  sword: KEY.SWORDS, melee: KEY.SWORDS,
  savemaps: KEY.SAVE_MAPS, mapsave: KEY.SAVE_MAPS, fastmaps: KEY.FAST_MAPS, fastload: KEY.FAST_MAPS,
  fast_load: KEY.FAST_MAPS, fastloadmaps: KEY.FAST_MAPS, fast_load_maps: KEY.FAST_MAPS,
});

export const GROUPS = Object.freeze([...new Set(Object.values(SCHEMA).map((s) => s.group))]);

export function resolveKey(word) {
  if (!word) return null;
  const k = word.toLowerCase();
  return SCHEMA[k] ? k : ALIASES[k] || null;
}

export const aliasesOf = (key) => Object.keys(ALIASES).filter((a) => ALIASES[a] === key);

// Changes the game (only while you are in a level) rather than the console.
export const affectsGame = (key) => !CONSOLE_GROUPS.has(SCHEMA[key].group);
export const keyClientOnly = (key) => (key && affectsGame(key) ? CLIENT_ONLY_REASON : undefined);

// "fast load maps on" -> "fast_maps on".
export const unphrase = (text) => Object.entries(SCHEMA)
  .reduce((t, [key, s]) => (s.phrases || []).reduce((u, re) => u.replace(re, key), t), text);

const TRUE_WORDS = ['1', 'on', 'true', 'yes', 'y', 'enable', 'enabled'];
const FALSE_WORDS = ['0', 'off', 'false', 'no', 'n', 'disable', 'disabled'];

export function parseValue(key, raw) {
  const s = SCHEMA[key];
  if (s.type === 'bool') {
    const v = String(raw).toLowerCase();
    if (TRUE_WORDS.includes(v)) return true;
    if (FALSE_WORDS.includes(v)) return false;
    throw new Error(`${key} expects on/off`);
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) throw new Error(`${key} expects a number`);
  if (s.type === 'int' && !Number.isInteger(n)) throw new Error(`${key} expects a whole number`);
  if (n < s.min || n > s.max) throw new Error(`${key} must be between ${s.min} and ${s.max}`);
  return n;
}

// The one-line description, with the default when there is one.
export const describeKey = (key) => {
  const s = SCHEMA[key];
  return s.default === undefined ? s.desc : `${s.desc} (default ${onOff(s.default)})`;
};

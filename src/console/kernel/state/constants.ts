import { PAGE_SIZE_DEFAULT, PAGE_SIZE_MAX } from '../core/constants.ts';
import { CAPABILITY, FEATURE, type FeatureId } from '#shared/features/keys.ts';
import { GROUP, SETTING_TYPE, type Group, type SettingType } from './keys.ts';

export type SettingSpec = Readonly<{
  feature: FeatureId;
  capability?: string;
  type: SettingType;
  group: Group;
  min?: number;
  max?: number;
  default?: boolean | number | string;
  desc: string;
  about?: readonly string[];
  example?: string;
  phrases?: readonly RegExp[];
}>;

export const SAVE_DELAY_MS = 150;
export const HISTORY_MAX = 200;

export const SCHEMA = Object.freeze({
  god: { feature: FEATURE.health, capability: CAPABILITY.health.god, type: SETTING_TYPE.bool, group: GROUP.player, desc: 'Ignore all damage' },
  max_hp: {
    feature: FEATURE.health, capability: CAPABILITY.health.hp, type: SETTING_TYPE.number, group: GROUP.player, min: 1, max: 1e9, desc: 'Force max HP (refills HP when changed)',
    about: ['Refills your HP whenever you change it. "hp 500" sets this key.'], example: '500',
  },
  hp_bonus: {
    feature: FEATURE.health, capability: CAPABILITY.health.hp, type: SETTING_TYPE.number, group: GROUP.player, min: -1e9, max: 1e9,
    desc: 'Added to max HP once per life/level, never stacks ("hp +100" / "hp -100")',
    about: ['Added once per life and per level, so it never stacks. "hp +100" sets this.'], example: '100',
  },
  hp_bonus_pct: {
    feature: FEATURE.health, capability: CAPABILITY.health.hp, type: SETTING_TYPE.number, group: GROUP.player, min: -100, max: 1e6,
    desc: 'Percent of the game\'s max HP added once per life/level ("hp +50%" / "hp -25%")',
    about: ['A percentage of the game\'s own max, added once per life and per level.', '"hp +50%" sets this.'],
    example: '50',
  },
  speed: { feature: FEATURE.movement, capability: CAPABILITY.movement.speed, type: SETTING_TYPE.number, group: GROUP.player, min: 0.1, max: 10, desc: 'Run speed multiplier, 1 = normal', example: '1.8' },
  jump: { feature: FEATURE.movement, capability: CAPABILITY.movement.jump, type: SETTING_TYPE.number, group: GROUP.player, min: 0, max: 20, desc: 'Jump strength multiplier, 1 = normal', example: '2' },
  gravity: { feature: FEATURE.movement, capability: CAPABILITY.movement.gravity, type: SETTING_TYPE.bool, group: GROUP.player, desc: 'Player gravity on/off' },
  fly: {
    feature: FEATURE.movement, capability: CAPABILITY.movement.fly, type: SETTING_TYPE.bool, group: GROUP.player, desc: 'Fly with jump/crouch keys (turns gravity off)',
    about: ['Fly with the jump and crouch keys. Turns gravity off while it is on.'],
  },
  fly_speed: { feature: FEATURE.movement, capability: CAPABILITY.movement.fly, type: SETTING_TYPE.number, group: GROUP.player, min: 0.5, max: 50, default: 6, desc: 'Vertical fly speed', example: '10' },
  swords: { feature: FEATURE.movement, capability: CAPABILITY.movement.swords, type: SETTING_TYPE.bool, group: GROUP.player, desc: 'Your swords on/off (other characters unaffected)' },
  world_gravity: {
    feature: FEATURE.movement, capability: CAPABILITY.movement.worldGravity, type: SETTING_TYPE.number, group: GROUP.world, min: -5, max: 5, desc: 'Gravity for everything (map default is usually 0.5)',
    about: ['Applies to everything, not just you. Most maps use 0.5.'], example: '0.2',
  },
  bullet_damage: { feature: FEATURE.guns, capability: CAPABILITY.guns.bullets, type: SETTING_TYPE.number, group: GROUP.bullets, min: 0, max: 1000, desc: 'Damage multiplier for your bullets', example: '5' },
  bullet_speed: { feature: FEATURE.guns, capability: CAPABILITY.guns.bullets, type: SETTING_TYPE.number, group: GROUP.bullets, min: 0.05, max: 20, desc: 'Speed multiplier for your bullets' },
  bullet_life: { feature: FEATURE.guns, capability: CAPABILITY.guns.bullets, type: SETTING_TYPE.number, group: GROUP.bullets, min: 0.05, max: 50, desc: 'Lifetime/range multiplier for your bullets' },
  penetration: {
    feature: FEATURE.guns, capability: CAPABILITY.guns.bullets, type: SETTING_TYPE.number, group: GROUP.bullets, min: 0, max: 1, desc: 'Damage kept per hit: 0 = game default (30%), 1 = no loss',
    about: ['How much damage a bullet keeps after each hit it passes through.'], example: '1',
  },
  fire_rate: { feature: FEATURE.guns, capability: CAPABILITY.guns.gun, type: SETTING_TYPE.number, group: GROUP.gun, min: 0.05, max: 20, desc: 'Fire-rate multiplier for held gun' },
  pellets: { feature: FEATURE.guns, capability: CAPABILITY.guns.gun, type: SETTING_TYPE.int, group: GROUP.gun, min: 1, max: 50, desc: 'Projectiles per shot for held gun' },
  spread: {
    feature: FEATURE.guns, capability: CAPABILITY.guns.gun, type: SETTING_TYPE.number, group: GROUP.gun, min: 0, max: 10, desc: 'Spread multiplier, 0 = perfectly accurate',
    about: ['0 makes the held gun perfectly accurate.'], example: '0',
  },
  recoil: { feature: FEATURE.guns, capability: CAPABILITY.guns.gun, type: SETTING_TYPE.number, group: GROUP.gun, min: 0, max: 10, desc: 'Recoil multiplier for held gun' },
  builtin: { feature: FEATURE.gameChat, capability: CAPABILITY.gameChat.builtin, type: SETTING_TYPE.bool, group: GROUP.console, desc: 'game <cmd>: on = silent, works on any map and in multiplayer; off = normal game chat' },
  trigger_history: {
    feature: FEATURE.triggers, type: SETTING_TYPE.bool, group: GROUP.console, default: true, desc: 'Record trigger runs for "triggers history"',
    about: ['Turns the recording for "triggers history" on and off.'],
  },
  page_size: {
    feature: FEATURE.consoleCore, type: SETTING_TYPE.int, group: GROUP.console, min: 10, max: PAGE_SIZE_MAX, default: PAGE_SIZE_DEFAULT,
    desc: 'Lines per page for long lists like "triggers"; "more" = next page',
    about: [`Lines per page for "triggers" and the other long lists. The default (${PAGE_SIZE_DEFAULT})`,
      'keeps a whole page inside this log.'],
    example: '50',
  },
  screenshot_key: {
    feature: FEATURE.screenshot, capability: CAPABILITY.screenshot.key, type: SETTING_TYPE.key, group: GROUP.console, default: 'f12',
    desc: 'Key that saves a screenshot to data/screenshots/, anywhere in the game; off = none',
    about: ['Works in menus, levels and with the console open (the console is left out of',
      'the picture). A function key works while you type; other keys wait until you',
      'are not typing in the chat or the console.'],
    example: 'f2',
  },
  editor_key: {
    feature: FEATURE.mapEditor, type: SETTING_TYPE.key, group: GROUP.console, default: 'f8',
    desc: 'Key that turns the map editor on and off in a level; off = none',
    about: ['Turns the in-game map editor on and off ("editor"). Works with the console',
      'open too. F11 is not the default: the window menu uses it for fullscreen.'],
    example: 'f7',
  },
  save_maps: {
    feature: FEATURE.mapCache, type: SETTING_TYPE.bool, group: GROUP.maps, default: true,
    desc: 'Save every map the game downloads to data/maps/<map id>.xml, uncompressed and one tag per line',
    about: ['Every map the game downloads is written to data/maps/<map id>.xml,', 'uncompressed and one XML tag per line.'],
    phrases: [/^save\s+maps?(?=\s|$)/i],
  },
  fast_maps: {
    feature: FEATURE.mapCache, type: SETTING_TYPE.bool, group: GROUP.maps, default: false,
    desc: 'Fast load: use the saved map from data/maps instead of downloading it again',
    about: ['Loads the saved copy from data/maps instead of downloading the map',
      'again. Single-player maps are served by the desktop wrapper; multiplayer maps',
      'are handed to the game as it joins a match.'],
    phrases: [/^fast\s+load(\s+maps?)?(?=\s|$)/i],
  },
  net_log: {
    feature: FEATURE.netlog, type: SETTING_TYPE.bool, group: GROUP.network, default: true,
    desc: 'Record the game\'s network messages and packet losses to data/netlogs/, one readable file per run ' +
      '("netlog" shows it)',
    about: ['Every message the game sends and receives on its connections, packet losses',
      '(slow and missing acks, dropped packets, gaps, late messages) and once a second',
      'the ping and traffic of each connection, as plain text in data/netlogs/: one file per',
      'run and game window. "netlog" shows it here, "netlog runs" lists other instances.'],
  },
  net_log_state: {
    feature: FEATURE.netlog, type: SETTING_TYPE.bool, group: GROUP.network, default: false,
    desc: 'Also record every unreliable state update (player state, 60 to 250 a second: large files)',
    about: ['State updates are sent every 16 ms over a socket and every 4 ms peer to peer.',
      'Off, they are only counted (STAT lines); on, each one is written too.'],
  },
  net_log_all: {
    feature: FEATURE.netlog, type: SETTING_TYPE.bool, group: GROUP.network, default: false,
    desc: 'Log everything: every packet (PKT: size, ack, what it carries) and every state update, decoded (very large files)',
    about: ['Adds a PKT line for every packet sent and received, also the ones that only',
      'carry an acknowledgement, and turns on net_log_state: every unreliable state',
      'update with its parts decoded, and writes every message whole (without it a part',
      'over 2000 characters, a map or a match list, is cut). 60 to 250 packets a second',
      'each way: large files.'],
  },
} satisfies Record<string, SettingSpec>);

export type SettingKey = keyof typeof SCHEMA;
export type KeyNames = { readonly [Key in SettingKey as Uppercase<Key>]: Key };

export const aliasesFor = (KEY: KeyNames): Readonly<Record<string, SettingKey>> => Object.freeze({
  hp: KEY.MAX_HP, maxhp: KEY.MAX_HP, health: KEY.MAX_HP, godmode: KEY.GOD,
  grav: KEY.GRAVITY, wgrav: KEY.WORLD_GRAVITY, pen: KEY.PENETRATION, pierce: KEY.PENETRATION,
  dmg: KEY.BULLET_DAMAGE, damage: KEY.BULLET_DAMAGE, bspeed: KEY.BULLET_SPEED, range: KEY.BULLET_LIFE,
  rate: KEY.FIRE_RATE, firerate: KEY.FIRE_RATE, accuracy: KEY.SPREAD, jumps: KEY.JUMP,
  sword: KEY.SWORDS, melee: KEY.SWORDS,
  screenshotkey: KEY.SCREENSHOT_KEY, shot_key: KEY.SCREENSHOT_KEY, sskey: KEY.SCREENSHOT_KEY,
  editorkey: KEY.EDITOR_KEY, edit_key: KEY.EDITOR_KEY,
  savemaps: KEY.SAVE_MAPS, mapsave: KEY.SAVE_MAPS, fastmaps: KEY.FAST_MAPS, fastload: KEY.FAST_MAPS,
  fast_load: KEY.FAST_MAPS, fastloadmaps: KEY.FAST_MAPS, fast_load_maps: KEY.FAST_MAPS,
  net_logs: KEY.NET_LOG, packet_log: KEY.NET_LOG, netlog_state: KEY.NET_LOG_STATE,
  netlog_all: KEY.NET_LOG_ALL, net_log_everything: KEY.NET_LOG_ALL,
});

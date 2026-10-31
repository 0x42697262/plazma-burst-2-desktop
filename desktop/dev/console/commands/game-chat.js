// "game <command>": the game's own chat commands (frame2.js keydown handler, around
// lines 26387-26870). The game has no "help" of its own, so the list is kept here.
import { print } from '../ui/log.js';
import { COLOR } from '../core/colors.js';
import { stripHtml } from '../core/text.js';
import { game } from '../game/bindings.js';
import { LEVEL_REQUIRED } from '../game/level.js';
import { F } from '../game/fields.js';
import { KEY } from '../state/schema.js';
import { settings } from '../state/store.js';
import { gameCommandHeldBack, refusal } from '../overrides/server-checks.js';

const NAME_WIDTH = 40;
const CHAT_PANEL_ITEMS = 11; // lines of the chat log panel
const PANEL_FIELDS = Object.freeze(['y', 'visible', 'alpha', 'timer']);
const NOT_FOUND = 'command not found'; // what the game says to an unknown command
const NO_TRIGGER = -1;

const GAME_COMMANDS = Object.freeze([
  ['Cheats', [
    ['god  /  god 1', 'Max HP x100000 and full heal'],
    ['god 0', 'Undo god (divides max HP by 100000)'],
    ['gm', 'Toggle a game-master flag (changes vehicle HP and health regen)'],
    ['hyper jump', 'Launch yourself upward'],
    ['headshot', 'Lose your head but keep your HP'],
    ['kill', 'Kill yourself'],
    ['kill enemies', 'Kill every character not on your team'],
  ]],
  ['Guns', [
    ['give <model>', 'Spawn a gun (upgrade 3) at your feet; picked up only if that slot is empty'],
    ['give all', 'Spawn 15 standard guns (upgrade 3) at your feet'],
  ]],
  ['Size and skins', [
    ['grow  /  shrink', 'Scale yourself x1.25 / /1.25 (HP and zoom follow)'],
    ['grow enemies  /  shrink enemies', 'Same for everyone else'],
    ['skin <n>  /  skin enemies <n>', 'Change your skin / everyone else\'s skin'],
    ['hero1skin <n>  /  hero2skin <n>', 'Set the skin used for hero 1 / hero 2'],
  ]],
  ['Game speed', [
    ['very slow | slower | slow', 'x0.25 | x0.5 | x0.75'],
    ['normal', 'x1'],
    ['fast | faster | very fast', 'x1.25 | x1.5 | x2'],
    ['extra fast | uber fast | over fast', 'x3 | x4 | x5'],
  ]],
  ['View', [
    ['zoom 25 | zoom 50 | zoom 100 | zoom 200', 'Camera zoom (only these four values; the console\'s "zoom" takes any)'],
    ['render 0  /  render 1', 'Hide / show the game world'],
    ['debug  /  debug 1  /  debug 0', 'Debug display on / on / off'],
  ]],
  ['Level', [
    ['quick start', 'Money 999999 and every campaign level unlocked'],
    ['no players | no barrels | no vehicles', 'Remove them from the level'],
    ['no lights  /  no lamps | no guns', 'Same for lights / map guns'],
    ['friends', 'Everyone on one team'],
    ['dm', 'Everyone on their own team (deathmatch)'],
    ['bot 1  /  bot 0', 'AI plays your character / you play again'],
  ]],
]);

const builtinOn = () => settings.get(KEY.BUILTIN) === true;

function printGameHelp() {
  print('Built-in game commands (run with: game <command>):', COLOR.title);
  for (const [group, cmds] of GAME_COMMANDS) {
    print(`[${group}]`, COLOR.title);
    for (const [c, d] of cmds) print(`  ${c.padEnd(NAME_WIDTH)} ${d}`);
  }
  print('Cheat commands show an "achievements disabled" warning and save the game state.', COLOR.hint);
  print([['WARNING: client-only. ', COLOR.warn, true],
    [`builtin is ${builtinOn() ? 'on: commands run silently on any map, also in multiplayer' : 'off: commands appear in game chat; the game refuses them in multiplayer'} ("builtin on|off").`, COLOR.hint, true]]);
}

// Types `text` into the game's chat and presses Enter (key down only). The game parses
// chat commands only when it is not multiplayer and not a custom map.
function pressEnterWithChat(text) {
  game.openChat(text);
  game.pressEnter();
}

function textOf(mc) {
  const out = [];
  const walk = (o, depth) => {
    if (!o || depth > 4) return;
    if (typeof o._htmlText === 'string' || typeof o._text === 'string') out.push(o.htmlText);
    if (Array.isArray(o.children)) for (const c of o.children) walk(c, depth + 1);
  };
  walk(mc, 0);
  return out.join(' ');
}

// The chat display before a command, so the lines it adds can be hidden afterwards.
function chatSnapshot() {
  const popups = game.chatPopups();
  const panel = game.chatPanel();
  const snap = { popups: popups.slice(), popupY: popups.map((m) => m.y), panel: null };
  if (panel && !panel.isRemoved) {
    snap.panel = [];
    for (let i = 0; i < CHAT_PANEL_ITEMS; i++) {
      const it = panel['item' + i];
      if (!it) continue;
      const item = { it, text: it[F.CHAT_TEXT] && it[F.CHAT_TEXT].htmlText };
      for (const f of PANEL_FIELDS) item[f] = it[f];
      snap.panel.push(item);
    }
  }
  return snap;
}

// Hides the chat lines added since `snap` and returns their plain text.
function chatRestore(snap) {
  const added = [];
  const popups = game.chatPopups();
  for (const m of popups) {
    if (snap.popups.includes(m)) continue;
    added.push(stripHtml(textOf(m)));
    m.visible = false; // the game removes it from the list on its own timer
  }
  snap.popups.forEach((m, i) => { if (popups.includes(m)) m.y = snap.popupY[i]; });
  for (const item of snap.panel || []) {
    const now = item.it[F.CHAT_TEXT] && item.it[F.CHAT_TEXT].htmlText;
    if (now !== item.text || item.it.timer !== item.timer) added.push(stripHtml(now));
    for (const f of PANEL_FIELDS) item.it[f] = item[f];
    if (item.it[F.CHAT_TEXT]) item.it[F.CHAT_TEXT].htmlText = item.text;
  }
  return added.filter(Boolean);
}

// builtin on: run the command with the multiplayer and custom-map flags cleared and the
// map's "player says" trigger detached, then hide any chat lines it produced.
function runSilent(text) {
  const mp = game.isMP();
  const custom = game.isCustomMap();
  const say = game.sayTrigger();
  const snap = chatSnapshot();
  let lines;
  try {
    game.setMP(false);
    game.setCustomMap(false);
    game.setSayTrigger(NO_TRIGGER);
    pressEnterWithChat(text);
  } finally {
    game.setMP(mp);
    game.setCustomMap(custom);
    game.setSayTrigger(say);
    lines = chatRestore(snap);
  }
  game.releaseEnter();
  // The first line is the game echoing the command back.
  if (lines.length && lines[0].endsWith(text)) lines.shift();
  const failed = lines.some((l) => l.includes(NOT_FOUND));
  for (const l of lines) print(`  game: ${l}`, failed ? COLOR.error : COLOR.hint);
  if (!failed) print(`ran: ${text}`, COLOR.ok);
}

function runGameCommand(text) {
  if (!text) throw new Error('usage: game <command>');
  const why = gameCommandHeldBack(text);
  if (why) throw refusal(`game ${text}`, why);
  if (!game.inLevelFrame()) throw new Error(LEVEL_REQUIRED);
  if (builtinOn()) { runSilent(text); return; }
  // builtin off: normal game chat. On custom maps the game sends chat to the map's
  // "player says" triggers instead of its command parser, so clear the custom-map flag
  // for this one Enter press only.
  const custom = game.isCustomMap();
  try {
    if (custom) game.setCustomMap(false);
    pressEnterWithChat(text);
  } finally {
    if (custom) game.setCustomMap(true);
  }
  game.releaseEnter();
  print(`sent to game: ${text} (output appears in game chat)`, COLOR.ok);
}

export const gameCommand = {
  name: 'game',
  usage: 'game <command>',
  desc: 'Run a built-in game chat command. "game help" lists them all',
  clientOnly: 'built-in commands run in your game only (with builtin off the game refuses them in multiplayer)',
  handlesHelp: true,
  help: {
    about: [
      'Runs one of the game\'s own chat commands. "game help" lists them all,',
      'grouped, with what each one does.',
    ],
    examples: [
      ['game help', 'every built-in command'],
      ['game god', 'the game\'s own god mode'],
      ['game kill enemies', 'kill everyone not on your team'],
    ],
    notes: [
      'With builtin on they run silently, on any map and in multiplayer. With',
      'builtin off they go through game chat, and the game refuses them in multiplayer.',
    ],
    see: ['builtin'],
  },
  run: (args, { rest }) => (!rest || rest.toLowerCase() === 'help' ? printGameHelp() : runGameCommand(rest)),
};

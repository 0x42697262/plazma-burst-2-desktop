// The dedicated host's driver ("npm run p2p-host"): logs in to the lobby server, starts the
// match from desktop/p2p-host.json as a player-hosted ("THIS DEVICE (UDP)") one, moves
// itself to the spectators, and keeps the match going: who joins and leaves, the
// "allow" list, the local map, and starting again when the match is gone.
// Every step is one the game takes itself: its lobby screen logs in, the create screen's
// message makes the match, the "Spectate" button's message moves the host, the match
// owner's chat commands ("-map", "-pause", ...) and kick button do the rest. The players
// play over WebRTC with this game; the lobby server lists the match, checks who may
// join and passes their connection offers along (docs/operations/p2p-host.md).
import { print } from '../ui/log.js';
import { COLOR } from '../../../../src/console/kernel/core/keys.ts';
import { MAP_MARKER as MAP } from '../../../../src/shared/contract/keys.ts';
import { stripHtml } from '../../../../src/console/kernel/core/words.ts';
import { SERVER } from '../core/server.js';
import { game, NET } from '../game/bindings.js';

const TICK_MS = 500;
const MENU = 'menu';
const LOBBY = 'MPLobby';
const SLOW_MS = 30000; // a step that takes longer is said once
const AWAY_MS = 8000; // back in the lobby or menu this long while running: the match is gone
const SPECTATE_RETRY_MS = 10000;
const KICK_AGAIN_MS = 30000;
const RESTART_PAUSE_MS = 3000;
const LOCAL_PREFIX = 'local-'; // the wrapper serves desktop/maps/<name>.xml as this map ID
const MAP_URL = '/pb2/server.php'; // where the game downloads maps; the wrapper answers local- IDs

export const PHASE = Object.freeze({
  boot: 'starting the game',
  lobby: 'logging in to the lobby server',
  creating: 'creating the match',
  joining: 'joining the match',
  running: 'running',
  waiting: 'waiting to start again',
  stopped: 'stopped',
});

const state = {
  phase: PHASE.boot,
  since: Date.now(),
  slowSaid: false,
  awaySince: 0,
  restartAt: 0,
  spectateAt: 0,
  last: '', // why it stopped or waits
  settings: null, // what the match was made with
  localMap: null, // { name, text, players }
  seen: new Map(), // connection -> { nickname, login, slot }
  kicked: new Map(), // auth id -> when
  guestSaid: false,
};

const cfg = () => SERVER.server;

function enter(phase, why = '') {
  state.phase = phase;
  state.since = Date.now();
  state.slowSaid = false;
  state.awaySince = 0;
  if (why) state.last = why;
}

function slowNote(what) {
  if (state.slowSaid || Date.now() - state.since < SLOW_MS) return;
  state.slowSaid = true;
  print(`Host: still ${what} after ${Math.round((Date.now() - state.since) / 1000)} s`, COLOR.warn);
}

// Stopped by itself: wait and start again, unless restart_after_s is 0.
function fail(why) {
  print(`Host: ${why}`, COLOR.error);
  state.seen.clear();
  if (cfg().restart_after_s > 0) {
    enter(PHASE.waiting, why);
    state.restartAt = Date.now() + cfg().restart_after_s * 1000;
    print(`Host: starting again in ${cfg().restart_after_s} s ("server stop" to stay stopped)`, COLOR.hint);
  } else {
    enter(PHASE.stopped, why);
    print('Host: stopped. "server start" starts it again.', COLOR.hint);
  }
}

// A reply from the lobby server arrives inside the game's network code: nothing thrown
// here may reach it.
const guarded = (what, fn) => (...args) => {
  try { fn(...args); } catch (e) { print(`Host: ${what}: ${e && e.message}`, COLOR.error); }
};

// The region the match browser shows, as the game's create screen finds it: the first
// part of this computer's time zone ("Europe/Berlin" -> "Europe").
const timeZoneRegion = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone.split('/').shift(); } catch { return ''; } };

function matchSettings() {
  const s = { ...SERVER.match };
  const me = game.myAccount() || {};
  if (!s.title) s.title = `Game by ${me.nickname || me.login || 'host'}`;
  if (!s.p2p_region) s.p2p_region = timeZoneRegion();
  return s;
}

function create() {
  const settings = matchSettings();
  const me = game.myAccount() || {};
  if (me.is_guest && !state.guestSaid) {
    state.guestSaid = true;
    print('Host: logged in as a guest. Changing the map, kicking and the other match owner commands need an account (desktop/credentials.json).', COLOR.warn);
  }
  state.settings = settings;
  game.setCreateSettings(settings, false);
  enter(PHASE.creating);
  print(`Host: creating "${settings.title}" on map ${settings.map_id} (${settings.game_type}, ${settings.max_players} players, region ${settings.p2p_region || 'none'})`, COLOR.title);
  game.sendLobby(NET.CREATE_MATCH, [JSON.stringify(settings), game.replyTo()], guarded('create reply', (reply) => {
    if (state.phase !== PHASE.creating) return;
    if (reply[0] === 'ok') {
      game.enterMatch(reply[1], reply[2]);
      game.setJoinPassword(settings.password);
      enter(PHASE.joining);
    } else {
      fail(`the lobby server did not create the match: ${stripHtml(String(reply[1]))}`);
    }
  }));
}

// From the start: the menu, the lobby, logged in, then create.
function start() {
  state.seen.clear();
  const label = game.frameLabel();
  if (game.lobbyReady() && label === LOBBY) { create(); return; }
  enter(PHASE.boot);
}

// The "Spectate" button's message: the host leaves its player slot for a spectator one.
function spectate() {
  const details = game.matchDetails();
  if (!details) return;
  game.sendLobby(NET.JOIN_MATCH, [details.uid, game.replyTo(), game.spectatorSlot(), '', state.settings ? state.settings.password : ''],
    guarded('spectate reply', (reply) => {
      if (reply[0] === 'ok') game.enterMatch(reply[1], reply[2]);
      else print(`Host: could not move to the spectators: ${stripHtml(String(reply[1]))}`, COLOR.warn);
    }));
}

// Everyone in the hosted match: [{ c, slot, self, login, nickname, ... }].
export function roster() {
  const match = game.hostedMatch();
  if (!match) return [];
  const me = String((game.myAccount() || {}).login || '').toLowerCase();
  const out = [];
  game.matchSlots(match).forEach((c, slot) => {
    if (!c) return;
    const info = game.slotInfo(c);
    out.push({ c, slot, ...info, self: !!me && info.login.toLowerCase() === me });
  });
  return out;
}

const who = (p) => (p.login && p.login !== p.nickname ? `${p.nickname} (${p.login})` : p.nickname || p.login || `slot ${p.slot}`);

function noteArrivals(rows) {
  const now = new Set();
  for (const p of rows) {
    now.add(p.c);
    if (state.seen.has(p.c) || p.self) continue;
    state.seen.set(p.c, { name: who(p) });
    const rep = p.reputation === undefined ? '' : `, reputation ${p.reputation}`;
    print(`+ ${who(p)} joined: slot ${p.slot}${p.spectator ? ', spectating' : ''}${p.guest ? ', guest' : ''}${rep}`, COLOR.ok);
  }
  for (const [c, { name }] of state.seen) {
    if (!now.has(c)) { state.seen.delete(c); print(`- ${name} left`, COLOR.hint); }
  }
}

// The match owner's kick: out of the match, and kept out of it (the match's ban list)
// until "server unbanall".
export function kick(p, why = '') {
  if (p.self) throw new Error('that is the host itself');
  if (p.authId === null || p.authId === undefined) throw new Error(`no auth id for ${who(p)} (not fully joined yet?)`);
  if (why) { try { tell(p, why); } catch {} }
  game.sendLobby(NET.KICK_USER, [String(p.authId), game.replyTo(), '0'], guarded('kick reply', (reply) => {
    print(`Kick ${who(p)}: ${stripHtml(String(reply[0]))}`, String(reply[0]).includes('successfully') ? COLOR.ok : COLOR.warn);
  }));
}

// A server message in one player's chat.
export function tell(p, text) {
  game.tellSlot(p.c, `Server: ${text}`);
}

function enforceAllow(rows) {
  const allow = cfg().allow;
  if (!allow.length) return;
  const now = Date.now();
  for (const p of rows) {
    if (p.self || allow.includes(p.login.toLowerCase()) || p.authId === null) continue;
    if (now - (state.kicked.get(p.authId) || 0) < KICK_AGAIN_MS) continue;
    state.kicked.set(p.authId, now);
    print(`Host: ${who(p)} is not on the "allow" list: kicking`, COLOR.warn);
    try { kick(p, 'this match is for invited players only'); } catch (e) { print(`Host: ${e.message}`, COLOR.error); }
  }
}

// ----- Local map: desktop/maps/<name>.xml, sent to the players by this host -----

async function loadLocalMap(name) {
  const body = new URLSearchParams({ rq: 'cmap', cmap: LOCAL_PREFIX + name });
  const r = await fetch(MAP_URL, { method: 'POST', body, cache: 'no-store' });
  const text = (await r.text()).replace(/^﻿/, '').trim();
  if (!r.ok || !text.startsWith('<') || text.startsWith(MAP.notPublished)) throw new Error(`no map "${name}" in desktop/maps`);
  return { name, text, players: (text.match(/<player\b/g) || []).length };
}

function applyLocalMap(match) {
  const m = state.localMap;
  game.setMatchMap(match, [m.text, m.name, '0', String(match.players_max), LOCAL_PREFIX + m.name]);
  print(`Map: ${m.name} from desktop/maps, sent to everyone in the match`, COLOR.ok);
  if (m.players && m.players < match.players_max) {
    print(`Note: ${m.name} has ${m.players} player start${m.players === 1 ? '' : 's'}; the match has ${match.players_max} player slots`, COLOR.hint);
  }
}

// Plays desktop/maps/<name>.xml from now on: now if the match runs, and again over any
// map the lobby server sends (a rotation, "-map").
export async function useLocalMap(name) {
  const m = await loadLocalMap(name);
  state.localMap = m;
  print(`Local map ${name} loaded (${m.text.length} characters)`, COLOR.ok);
  const match = game.hostedMatch();
  if (state.phase === PHASE.running && match) applyLocalMap(match);
  else print('It is sent to the players once the match runs.', COLOR.hint);
}

export function dropLocalMap() {
  const had = state.localMap;
  state.localMap = null;
  return had;
}

// ----- The match's own chat commands, sent as the match owner -----

export function ownerCommand(text) {
  if (state.phase !== PHASE.running) throw new Error(`the match is not running (${state.phase})`);
  game.sendChat(text);
}

export function say(text) {
  if (state.phase !== PHASE.running) throw new Error(`the match is not running (${state.phase})`);
  game.sendChat(text);
}

export function stop() {
  const wasRunning = state.phase === PHASE.running;
  if (wasRunning) { try { game.sendChat('-terminate'); } catch {} }
  enter(PHASE.stopped, 'stopped from the terminal');
  state.seen.clear();
  return wasRunning;
}

export function startAgain() {
  if (state.phase !== PHASE.stopped && state.phase !== PHASE.waiting) throw new Error(`already ${state.phase}`);
  start();
}

export function restart() {
  stop();
  enter(PHASE.waiting, 'restart from the terminal');
  state.restartAt = Date.now() + RESTART_PAUSE_MS;
}

export function hostStatus() {
  return {
    phase: state.phase,
    seconds: Math.round((Date.now() - state.since) / 1000),
    last: state.last,
    settings: state.settings,
    localMap: state.localMap ? state.localMap.name : '',
    match: game.hostedMatch(),
    restartIn: state.phase === PHASE.waiting ? Math.max(0, Math.round((state.restartAt - Date.now()) / 1000)) : null,
  };
}

function running() {
  const match = game.hostedMatch();
  const label = game.frameLabel();
  const away = label === LOBBY || label === MENU;
  if (!match) { fail('the match is gone'); return; }
  if (away) {
    if (!state.awaySince) state.awaySince = Date.now();
    else if (Date.now() - state.awaySince > AWAY_MS) { fail(`the game left the match (screen "${label}")`); return; }
  } else {
    state.awaySince = 0;
  }
  const now = Date.now();
  if (!cfg().host_plays && game.inLevelFrame() && !game.isSpectating() && now > state.spectateAt) {
    state.spectateAt = now + SPECTATE_RETRY_MS;
    spectate();
  }
  if (state.localMap && game.matchMapText(match) !== state.localMap.text) applyLocalMap(match);
  const rows = roster();
  noteArrivals(rows);
  enforceAllow(rows);
}

function tick() {
  switch (state.phase) {
    case PHASE.boot: {
      const label = game.frameLabel();
      if (label === MENU) { game.goToScreen(LOBBY); enter(PHASE.lobby); } else if (label === LOBBY) enter(PHASE.lobby);
      else slowNote(`waiting for the game's menu (screen "${label}")`);
      break;
    }
    case PHASE.lobby:
      if (game.lobbyReady()) create();
      else slowNote('waiting to log in to the lobby server');
      break;
    case PHASE.creating:
      slowNote('waiting for the lobby server to create the match');
      break;
    case PHASE.joining:
      if (game.hostedMatch() && game.inLevelFrame()) {
        enter(PHASE.running);
        const s = state.settings;
        print(`Host: running "${s.title}"${s.password ? ' (password set)' : ''}. Players find it in the match browser under ${s.p2p_region || 'no region'}, player-hosted.`, COLOR.ok);
      } else {
        slowNote('waiting to join the match');
      }
      break;
    case PHASE.running:
      running();
      break;
    case PHASE.waiting:
      if (Date.now() >= state.restartAt) start();
      break;
    default:
      break;
  }
}

let ticking = null;

// Called once by index.js when the game's stage exists, on the dedicated host only.
export function startHost() {
  if (ticking || !SERVER) return;
  game.setChatTrace(true); // chat lines reach the terminal (desktop/main.js)
  if (cfg().ice_servers.length) game.addIceServers(cfg().ice_servers);
  if (cfg().local_map) useLocalMap(cfg().local_map).catch((e) => print(`Host: local_map: ${e.message}`, COLOR.error));
  print('Dedicated host. Type "help server" for its commands; every console command works too.', COLOR.bright);
  ticking = setInterval(guarded('tick', tick), TICK_MS);
}

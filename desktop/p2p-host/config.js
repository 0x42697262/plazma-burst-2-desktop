// The dedicated host's settings ("npm run p2p-host"): desktop/p2p-host.json, or the file
// given with --config. Two parts:
//   match   the game's own match preset, the JSON its create screen copies with
//           "Copy Preset as text" (title, map_id, max_players, password, ...). Sent to
//           the lobby server as the create screen would, always as a player-hosted
//           ("THIS DEVICE (UDP)") match that is not ranked.
//   the rest  what only the host does: who may stay, which local map it serves, the
//           UDP ports and ICE servers its WebRTC uses, the frame rate it runs at.
// See desktop/p2p-host/README.md.
'use strict';

const fs = require('fs');

// The create screen's choices (scripts/screens/MPCreateMatch.js).
const GAME_TYPES = Object.freeze(['DM', 'TDM', 'COOP']);
const MAX_PLAYERS = Object.freeze([2, 3, 4, 5, 6, 8, 16, 32, 64]);
const PING_ACTIONS = Object.freeze(['spectate', 'spectate_then_ban', 'pause_match', 'notify_everyone']);
const RESPAWN_MODELS = Object.freeze(['v2', 'v1']);
const MIN_REPUTATION = Object.freeze([0, 1, 5, 10, 20, 40]);
const ROUNDS_DEFAULT = 15; // the game's own default ("ROUNDS TOTAL")

// The create screen's defaults, made player-hosted and unranked (stats of player-hosted
// matches are not counted, and spectating, which the host does, is not allowed in a
// ranked match). map_rotation off: a private match plays the map it is given.
const MATCH_DEFAULTS = Object.freeze({
  title: '',
  map_id: '',
  map_rotation: '',
  game_type: 'DM',
  max_players: 8,
  password: '',
  gameplay_modifications: '',
  min_reputation: 0,
  exclude_inactive_players: true,
  ping_limit: '',
  ping_limit_action: 'spectate',
  rounds_until_rotation: String(ROUNDS_DEFAULT),
  round_duration_str: 'default',
  round_duration: 0,
  respawn_model: 'v2',
  allow_vpn_guests: 1,
  ranked: false,
  p2p: true,
  p2p_region: '',
  accept_connections_manually: false,
});
// Set by the host whatever the file says, with why.
const FORCED = Object.freeze({
  p2p: [true, 'the dedicated host only hosts on this device'],
  ranked: [false, 'player-hosted matches are not ranked, and the host spectates'],
  accept_connections_manually: [false, 'the game asks in a dialog nobody can click here; use "allow" instead'],
});

const SERVER_DEFAULTS = Object.freeze({
  allow: [],
  host_plays: false,
  local_map: '',
  region: '',
  udp_ports: '',
  ice_servers: [],
  fps: 60,
  restart_after_s: 15,
});
const FPS_RANGE = [10, 120];
const PORT_RANGE = [1024, 65535];
const MAX_REGION = 40;
const LOCAL_MAP_NAME = /^[A-Za-z0-9 _%-][A-Za-z0-9 _.%-]{0,79}$/;
const LOGIN = /^[^\s]{1,40}$/;

// The game's ROUND DURATION field: "default", or e.g. "1 hour 30 minutes 5 seconds"
// (MPCreateMatch.js reads it into milliseconds). null when it cannot be read.
function roundDurationMs(text) {
  const s = String(text ?? '').trim().toLowerCase();
  if (s === '' || s === 'default' || s === 'auto') return 0;
  const UNIT = { hour: 3600000, minute: 60000, second: 1000 };
  let ms = 0;
  let rest = s.replace(/,/g, '.');
  const part = /^\s*(\d+(?:\.\d+)?)\s*(hour|minute|second)s?\s*/;
  for (let m; (m = rest.match(part));) {
    ms += Number(m[1]) * UNIT[m[2]];
    rest = rest.slice(m[0].length);
  }
  return rest.trim() || ms <= 0 ? null : Math.round(ms);
}

// "50000-50100" -> { min, max }; '' -> null. Throws on anything else.
function parsePorts(v) {
  if (v === '' || v === null || v === undefined) return null;
  const m = String(v).trim().match(/^(\d+)\s*-\s*(\d+)$/) || String(v).trim().match(/^(\d+)()$/);
  if (!m) throw new Error(`udp_ports: "${v}" is not a port range like "50000-50100"`);
  const min = Number(m[1]);
  const max = m[2] ? Number(m[2]) : min;
  if (min < PORT_RANGE[0] || max > PORT_RANGE[1] || min > max) throw new Error(`udp_ports: "${v}" must be ${PORT_RANGE[0]}-${PORT_RANGE[1]}, low to high`);
  return { min, max };
}

// RTCIceServer entries: "stun:host:port", or { urls, username, credential }.
function parseIceServers(v) {
  if (!Array.isArray(v)) throw new Error('ice_servers: a list, e.g. ["stun:stun.example.com:3478"]');
  return v.map((s, i) => {
    const entry = typeof s === 'string' ? { urls: s } : s;
    const urls = entry && [].concat(entry.urls || []);
    if (!urls || !urls.length || !urls.every((u) => typeof u === 'string' && /^(stun|stuns|turn|turns):/.test(u))) {
      throw new Error(`ice_servers[${i}]: needs "urls" starting with stun:, stuns:, turn: or turns:`);
    }
    if (urls.some((u) => u.startsWith('turn')) && (typeof entry.username !== 'string' || typeof entry.credential !== 'string')) {
      throw new Error(`ice_servers[${i}]: a TURN server needs "username" and "credential"`);
    }
    const out = { urls: urls.length === 1 ? urls[0] : urls };
    if (entry.username !== undefined) out.username = String(entry.username);
    if (entry.credential !== undefined) out.credential = String(entry.credential);
    return out;
  });
}

// The match part: the game's preset keys, checked. Returns { match, problems, errors }.
function checkMatch(raw) {
  const problems = [];
  const errors = [];
  const match = { ...MATCH_DEFAULTS };
  if (raw === undefined) raw = {};
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { match, problems, errors: ['"match" must be an object'] };
  for (const [k, v] of Object.entries(raw)) {
    if (!(k in MATCH_DEFAULTS)) { problems.push(`match.${k}: not a setting of the game's create screen, left out`); continue; }
    if (k in FORCED) {
      const [value, why] = FORCED[k];
      if (v !== value) problems.push(`match.${k}: always ${value} here (${why})`);
      continue;
    }
    match[k] = v;
  }
  const str = (k) => { if (typeof match[k] !== 'string') { if (typeof match[k] === 'number') match[k] = String(match[k]); else errors.push(`match.${k}: must be text`); } };
  for (const k of ['title', 'map_id', 'map_rotation', 'password', 'gameplay_modifications', 'round_duration_str']) str(k);
  if (errors.length) return { match, problems, errors };

  if (!match.map_id.trim()) errors.push('match.map_id: the map to start with (a published map ID, e.g. "nanotech-cht", or "random approved")');
  if (match.title.length > 100) errors.push('match.title: at most 100 characters');
  for (const k of ['title', 'map_id']) if (match[k].includes('[^c]')) errors.push(`match.${k}: "[^c]" is not allowed (the server splits on it)`);
  match.game_type = String(match.game_type).toUpperCase();
  if (!GAME_TYPES.includes(match.game_type)) errors.push(`match.game_type: one of ${GAME_TYPES.join(', ')}`);
  match.max_players = Number(match.max_players);
  if (!MAX_PLAYERS.includes(match.max_players)) errors.push(`match.max_players: one of ${MAX_PLAYERS.join(', ')}`);
  match.min_reputation = Number(match.min_reputation);
  if (!MIN_REPUTATION.includes(match.min_reputation)) errors.push(`match.min_reputation: one of ${MIN_REPUTATION.join(', ')}`);
  if (typeof match.exclude_inactive_players !== 'boolean') errors.push('match.exclude_inactive_players: true or false');
  if (match.ping_limit !== '' && !(Number.isInteger(Number(match.ping_limit)) && Number(match.ping_limit) >= 0)) errors.push('match.ping_limit: "" (none) or milliseconds');
  match.ping_limit = match.ping_limit === '' ? '' : String(Number(match.ping_limit));
  if (!PING_ACTIONS.includes(match.ping_limit_action)) errors.push(`match.ping_limit_action: one of ${PING_ACTIONS.join(', ')}`);
  if (!RESPAWN_MODELS.includes(match.respawn_model)) errors.push(`match.respawn_model: one of ${RESPAWN_MODELS.join(', ')}`);
  const rounds = Number(match.rounds_until_rotation);
  if (!Number.isInteger(rounds) || rounds < 1) errors.push('match.rounds_until_rotation: a whole number from 1');
  else match.rounds_until_rotation = String(rounds);
  const ms = roundDurationMs(match.round_duration_str);
  if (ms === null) errors.push(`match.round_duration_str: "default", or like "10 minutes" or "1 hour 30 minutes"`);
  else match.round_duration = ms;
  match.allow_vpn_guests = match.allow_vpn_guests ? 1 : 0;
  if (typeof match.p2p_region !== 'string' || match.p2p_region.length > MAX_REGION) errors.push(`match.p2p_region: text, at most ${MAX_REGION} characters`);
  return { match, problems, errors };
}

// The whole file's object. Returns { match, server, problems, errors }: problems are
// warnings (the host starts), errors stop it.
function checkConfig(obj) {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { match: null, server: null, problems: [], errors: ['the file must hold a JSON object'] };
  const { match, problems, errors } = checkMatch(obj.match);
  const server = { ...SERVER_DEFAULTS };
  for (const [k, v] of Object.entries(obj)) {
    if (k === 'match' || k.startsWith('_')) continue; // "_comment" and the like
    if (!(k in SERVER_DEFAULTS)) { problems.push(`${k}: unknown setting, left out`); continue; }
    server[k] = v;
  }
  if (!Array.isArray(server.allow) || !server.allow.every((l) => typeof l === 'string' && LOGIN.test(l.trim()))) {
    errors.push('allow: a list of account logins, e.g. ["friend1", "friend2"]');
  } else {
    server.allow = [...new Set(server.allow.map((l) => l.trim().toLowerCase()))];
  }
  if (typeof server.host_plays !== 'boolean') errors.push('host_plays: true or false');
  if (typeof server.local_map !== 'string' || (server.local_map && !LOCAL_MAP_NAME.test(server.local_map))) {
    errors.push('local_map: the name of a file in desktop/maps without .xml, or ""');
  } else {
    server.local_map = server.local_map.replace(/^local-/i, '').replace(/\.(xml|txt)$/i, '');
  }
  if (typeof server.region !== 'string' || server.region.length > MAX_REGION) errors.push(`region: text, at most ${MAX_REGION} characters`);
  else if (server.region) match.p2p_region = server.region;
  try { server.udp_ports = parsePorts(server.udp_ports); } catch (e) { errors.push(e.message); }
  try { server.ice_servers = parseIceServers(server.ice_servers); } catch (e) { errors.push(e.message); }
  server.fps = Number(server.fps);
  if (!Number.isInteger(server.fps) || server.fps < FPS_RANGE[0] || server.fps > FPS_RANGE[1]) errors.push(`fps: ${FPS_RANGE[0]}-${FPS_RANGE[1]}`);
  server.restart_after_s = Number(server.restart_after_s);
  if (!Number.isFinite(server.restart_after_s) || server.restart_after_s < 0) errors.push('restart_after_s: seconds, 0 = never start again by itself');

  if (server.local_map && match.map_rotation) {
    problems.push(`match.map_rotation is "${match.map_rotation}": each rotation brings the server's next map, and the host puts local_map back over it (everyone reloads twice). Set it to "" to stay on the local map.`);
  }
  if (Array.isArray(server.allow) && !server.allow.length && !match.password) {
    problems.push('no "allow" list and no match.password: anyone who sees the match in the browser can join');
  }
  return { match, server, problems, errors };
}

// Reads and checks a config file. { match, server, problems, errors, missing }.
function loadConfig(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') return { match: null, server: null, problems: [], errors: [], missing: true };
    return { match: null, server: null, problems: [], errors: [`${file}: ${e.message}`], missing: false };
  }
  let obj;
  try {
    obj = JSON.parse(text.replace(/^﻿/, ''));
  } catch (e) {
    return { match: null, server: null, problems: [], errors: [`${file} is not valid JSON: ${e.message}`], missing: false };
  }
  return { ...checkConfig(obj), missing: false };
}

// npm run p2p-host -- [--config file]. Returns { config, problems }.
function parseServerArgs(argv) {
  const problems = [];
  let config = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--config') {
      config = argv[i + 1] || null;
      if (!config) problems.push('--config needs a file');
      i++;
    } else if (argv[i].startsWith('--config=')) {
      config = argv[i].slice('--config='.length) || null;
    }
  }
  return { config, problems };
}

module.exports = {
  checkConfig, checkMatch, loadConfig, parseServerArgs, roundDurationMs, parsePorts, parseIceServers,
  MATCH_DEFAULTS, SERVER_DEFAULTS, GAME_TYPES, MAX_PLAYERS,
};

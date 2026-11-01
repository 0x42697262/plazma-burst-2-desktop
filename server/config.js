// The server's settings: server/server.json (or --config <file>). Every key is optional.
// See docs/operations/private-server.md.
'use strict';

const fs = require('fs');

const DEFAULTS = Object.freeze({
  name: 'Plazma Burst 2 server', // shown in the players' server list
  description: '', // a line under it there
  port: 2053, // the game's own lobby port
  bind: '0.0.0.0',
  password: '', // players enter it when they add the server to their server list
  nicknames: [], // who may log in; [] = anyone with the password
  admins: [], // nicknames with staff rights: -announce, end any match, kick or ban anyone
  max_players: 64,
  skin: 1, // the skin everyone starts with (they can change it in the game)
  download_maps: true, // published map IDs come from the site; false = desktop/maps only
  random_maps: [], // your list of map IDs "random approved" picks from; empty = every map in desktop/maps
  cheat_reports: 'log', // the game's anti-cheat reports: "log" them, or "kick" the player too
  welcome: '', // a server line each player gets after logging in
});
const CHEAT = Object.freeze(['log', 'kick']);
const NAME = /^[A-Za-z0-9 _.\-]{1,20}$/;

function checkConfig(obj) {
  const problems = [];
  const errors = [];
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { server: null, problems, errors: ['the file must hold a JSON object'] };
  const server = { ...DEFAULTS };
  for (const [k, v] of Object.entries(obj)) {
    if (k.startsWith('_')) continue;
    if (!(k in DEFAULTS)) { problems.push(`${k}: unknown setting, left out`); continue; }
    server[k] = v;
  }
  server.port = Number(server.port);
  if (!Number.isInteger(server.port) || server.port < 0 || server.port > 65535) errors.push('port: 1-65535 (0: any free port)');
  if (typeof server.bind !== 'string' || !server.bind) errors.push('bind: an address to listen on, e.g. "0.0.0.0"');
  if (typeof server.password !== 'string') errors.push('password: text');
  for (const k of ['nicknames', 'admins']) {
    if (!Array.isArray(server[k]) || !server[k].every((n) => typeof n === 'string' && NAME.test(n.trim()))) errors.push(`${k}: a list of nicknames (1-20 letters, digits, spaces, _ . -)`);
    else server[k] = [...new Set(server[k].map((n) => n.trim().toLowerCase()))];
  }
  server.max_players = Number(server.max_players);
  if (!Number.isInteger(server.max_players) || server.max_players < 1) errors.push('max_players: a whole number from 1');
  server.skin = Number(server.skin);
  if (!Number.isInteger(server.skin) || server.skin < 0) errors.push('skin: a skin number');
  if (typeof server.download_maps !== 'boolean') errors.push('download_maps: true or false');
  if (!Array.isArray(server.random_maps) || !server.random_maps.every((m) => typeof m === 'string' && m.trim() && !m.includes(','))) errors.push('random_maps: a list of map IDs');
  else server.random_maps = [...new Set(server.random_maps.map((m) => m.trim()))];
  if (!CHEAT.includes(server.cheat_reports)) errors.push(`cheat_reports: ${CHEAT.join(' or ')}`);
  if (typeof server.welcome !== 'string') errors.push('welcome: text');
  if (typeof server.name !== 'string' || !server.name.trim() || server.name.length > 40) errors.push('name: text, 1-40 characters');
  if (typeof server.description !== 'string' || server.description.length > 200) errors.push('description: text, at most 200 characters');
  if (!errors.length && !server.password && !server.nicknames.length) {
    problems.push('no "password" and no "nicknames": anyone who can reach this address and port can log in');
  }
  return { server, problems, errors };
}

// { server, problems, errors, missing }
function loadConfig(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (e) {
    if (e.code === 'ENOENT') return { ...checkConfig({}), missing: true };
    return { server: null, problems: [], errors: [`${file}: ${e.message}`], missing: false };
  }
  try {
    return { ...checkConfig(JSON.parse(text.replace(/^﻿/, ''))), missing: false };
  } catch (e) {
    return { server: null, problems: [], errors: [`${file} is not valid JSON: ${e.message}`], missing: false };
  }
}

module.exports = { checkConfig, loadConfig, DEFAULTS };

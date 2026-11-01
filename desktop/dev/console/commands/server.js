// "server": the dedicated host's commands ("npm run p2p-host", server/host.js), typed in
// its terminal. Only on the dedicated host (`server: true`, src/console/kernel/core/mode.ts). "who",
// "kick" and "say" are the same as their "server" subcommands, for short.
import { print } from '../../../../src/console/kernel/ui/log.ts';
import { COLOR } from '../../../../src/console/kernel/core/keys.ts';
import { SERVER } from '../../../../src/console/kernel/core/mode.ts';
import {
  PHASE, roster, kick, tell, say, ownerCommand, useLocalMap, dropLocalMap, stop, startAgain, restart, hostStatus,
} from '../server/host.js';

const PING_ACTIONS = Object.freeze(['spectate', 'spectate_then_ban', 'pause_match', 'notify_everyone']);

const name = (p) => (p.login && p.login !== p.nickname ? `${p.nickname} (${p.login})` : p.nickname || p.login || `slot ${p.slot}`);

// A player by "#3" / "3" (slot), nickname or login, or the start of one of them.
function findPlayer(word) {
  if (!word) throw new Error('which player? A slot number, nickname or login ("who" lists them)');
  const rows = roster().filter((p) => !p.self);
  const w = String(word).replace(/^#/, '').toLowerCase();
  if (/^\d+$/.test(w)) {
    const p = rows.find((r) => r.slot === Number(w));
    if (p) return p;
  }
  const exact = rows.filter((r) => r.nickname.toLowerCase() === w || r.login.toLowerCase() === w);
  if (exact.length === 1) return exact[0];
  const start = rows.filter((r) => r.nickname.toLowerCase().startsWith(w) || r.login.toLowerCase().startsWith(w));
  if (start.length === 1) return start[0];
  if (start.length > 1) throw new Error(`"${word}" could be ${start.map(name).join(', ')}`);
  throw new Error(`no player "${word}" in the match ("who" lists them)`);
}

function printWho() {
  const rows = roster();
  const s = hostStatus();
  if (!s.match) { print(`No match (${s.phase})`, COLOR.notice); return; }
  const players = rows.filter((p) => !p.spectator && !p.self).length;
  print(`${players} of ${s.match.players_max} players, ${rows.filter((p) => p.spectator && !p.self).length} spectating`, COLOR.title);
  const head = ['slot', 'name', 'ping', 'team', 'hp', 'rep'];
  const lines = rows.map((p) => [
    String(p.slot), name(p) + (p.self ? '  [this host]' : '') + (p.guest ? '  [guest]' : ''),
    p.ping === undefined ? '-' : `${Math.round(p.ping)} ms`,
    p.spectator ? 'spectator' : String(p.team ?? '-'), p.spectator ? '-' : String(Math.round(p.hp ?? 0)),
    p.reputation === undefined ? '-' : String(p.reputation),
  ]);
  const widths = head.map((h, i) => Math.max(h.length, ...lines.map((l) => l[i].length)));
  const row = (cols) => `  ${cols.map((c, i) => c.padEnd(widths[i])).join('  ')}`;
  print(row(head), COLOR.hint);
  for (const l of lines) print(row(l));
}

function printStatus() {
  const s = hostStatus();
  const m = SERVER.match;
  const c = SERVER.server;
  print(`Host: ${s.phase} for ${s.seconds} s${s.restartIn !== null ? `, starting again in ${s.restartIn} s` : ''}`, COLOR.title);
  if (s.last && s.phase !== PHASE.running) print(`  last: ${s.last}`, COLOR.hint);
  const set = s.settings || m;
  print(`  match:    "${set.title || '(Game by <you>)'}", ${set.game_type}, ${set.max_players} players, password ${set.password ? 'set' : 'none'}`);
  if (s.match) print(`  map:      ${s.match.map_name || '?'} (${s.match.map_id || '?'})${s.localMap ? `, local map ${s.localMap} held` : ''}`);
  else print(`  map:      ${set.map_id}${s.localMap ? `, then local map ${s.localMap}` : ''}`);
  print(`  region:   ${set.p2p_region || '(this computer\'s time zone)'}`);
  print(`  allow:    ${c.allow.length ? c.allow.join(', ') : 'anyone who can join'}`);
  print(`  host:     ${c.host_plays ? 'plays' : 'spectates'}, ${c.fps} fps${c.udp_ports ? `, UDP ports ${c.udp_ports.min}-${c.udp_ports.max}` : ''}${c.ice_servers.length ? `, ${c.ice_servers.length} extra ICE server(s)` : ''}`);
  if (s.match) printWho();
}

const owner = (text) => () => { ownerCommand(text); print(`Sent "${text}"`, COLOR.ok); };

function map(args) {
  const s = hostStatus();
  if (!args.length) {
    if (s.match) print(`Map: ${s.match.map_name} (${s.match.map_id})${s.localMap ? `; local map ${s.localMap} is held` : ''}`);
    else print(`No match (${s.phase})`, COLOR.notice);
    return;
  }
  if (args[0].toLowerCase() === 'local') {
    const n = args.slice(1).join(' ').replace(/^local-/i, '').replace(/\.(xml|txt)$/i, '');
    if (!n) throw new Error('usage: server map local <name>   (a file in desktop/maps; "maps" lists them)');
    useLocalMap(n).catch((e) => print(`error: ${e.message}`, COLOR.error));
    return;
  }
  const id = args.join(' ');
  const had = dropLocalMap();
  ownerCommand(`-map ${id}`);
  print(`Sent "-map ${id}"${had ? ` (local map ${had.name} no longer held)` : ''}`, COLOR.ok);
}

const SUBCOMMANDS = [
  { name: 'status', aliases: ['info'], usage: 'server status', desc: 'What the host is doing, the match settings and who is in it', run: printStatus },
  { name: 'who', aliases: ['players'], usage: 'server who', desc: 'Everyone in the match: slot, name, ping, team, HP, reputation', run: printWho },
  {
    name: 'kick', usage: 'server kick <player>', desc: 'Exclude a player and keep them out of this match ("server unbanall" lets them back)',
    run: (args) => kick(findPlayer(args.join(' '))),
  },
  {
    name: 'tell', aliases: ['pm', 'whisper'], usage: 'server tell <player> <text>', desc: 'A server message only that player sees', rawLine: true,
    run: (args) => {
      const p = findPlayer(args[0]);
      const text = args.slice(1).join(' ');
      if (!text) throw new Error('usage: server tell <player> <text>');
      tell(p, text);
      print(`To ${name(p)}: ${text}`, COLOR.ok);
    },
  },
  {
    name: 'say', usage: 'server say <text>', desc: 'Chat to everyone in the match, as the host', rawLine: true,
    run: (args) => { if (!args.length) throw new Error('usage: say <text>'); say(args.join(' ')); },
  },
  {
    name: 'map', usage: 'server map [<map ID> | next | reload | local <name>]',
    desc: 'Change the map: a published one through the lobby server, or one from desktop/maps sent by this host',
    help: {
      about: [
        'Without a word: the map now. A map ID, "next" (rotation on) or "reload" goes',
        'through the lobby server, as the match owner\'s "-map" chat command does.',
        '"local <name>" plays desktop/maps/<name>.xml: this host sends it to every',
        'player, and puts it back over any map the lobby server sends later.',
      ],
      examples: [['server map nanotech-cht', 'a published map'], ['server map local my-arena', 'desktop/maps/my-arena.xml'], ['server map reload', 'restart the map']],
      see: ['maps'],
    },
    run: map,
  },
  { name: 'pause', usage: 'server pause', desc: 'Pause or resume the match ("-pause")', run: owner('-pause') },
  { name: 'swap', usage: 'server swap', desc: 'Swap the teams ("-swap")', run: owner('-swap') },
  { name: 'endround', usage: 'server endround', desc: 'End the round, Cooperative only ("-endround")', run: owner('-endround') },
  { name: 'unbanall', usage: 'server unbanall', desc: 'Let every kicked player join again ("-unbanall")', run: owner('-unbanall') },
  {
    name: 'ping', usage: 'server ping <ms | off>', desc: 'Ping limit for players ("-ping"); 0 or off removes it',
    run: (args) => {
      const v = (args[0] || '').toLowerCase();
      const ms = v === 'off' ? 0 : Number(v);
      if (!Number.isInteger(ms) || ms < 0) throw new Error('usage: server ping <ms | off>');
      owner(`-ping ${ms}`)();
    },
  },
  {
    name: 'ping_action', usage: `server ping_action <${PING_ACTIONS.join(' | ')}>`, desc: 'What happens over the ping limit ("-ping_action")',
    run: (args) => {
      if (!PING_ACTIONS.includes(args[0])) throw new Error(`usage: server ping_action <${PING_ACTIONS.join(' | ')}>`);
      owner(`-ping_action ${args[0]}`)();
    },
  },
  {
    name: 'min_reputation', aliases: ['minrep'], usage: 'server min_reputation <n>', desc: 'Lowest reputation that may stay ("-min_reputation"); players below it are removed',
    run: (args) => {
      const n = Number(args[0]);
      if (!Number.isInteger(n) || n < 0) throw new Error('usage: server min_reputation <n>');
      owner(`-min_reputation ${n}`)();
    },
  },
  {
    name: 'stop', usage: 'server stop', desc: 'End the match ("-terminate") and stay stopped',
    run: () => { const was = stop(); print(was ? 'Match ended. "server start" starts a new one.' : 'Stopped. "server start" starts a new match.', COLOR.ok); },
  },
  { name: 'start', usage: 'server start', desc: 'Start a new match after "server stop"', run: () => { startAgain(); print('Starting', COLOR.ok); } },
  { name: 'restart', usage: 'server restart', desc: 'End the match and start a new one with the same settings', run: () => { restart(); print('Restarting in a few seconds', COLOR.ok); } },
];

export const serverCommand = {
  name: 'server',
  server: true,
  usage: 'server <status | who | kick | tell | say | map | pause | swap | endround | unbanall | ping | stop | start | restart>',
  desc: 'The dedicated host: its match, players and match owner commands',
  help: {
    about: [
      'This window hosts one player-hosted match, set up from desktop/p2p-host.json.',
      'Players find it in the game\'s match browser and play over WebRTC with this',
      'host; the lobby server lists it and passes their connections along.',
      'Commands that change the match are the match owner\'s own chat commands, sent',
      'by this host. Every other console command works here too.',
    ],
    examples: [
      ['server status', 'what it is doing'],
      ['who', 'the players'],
      ['kick 3', 'the player in slot 3'],
      ['say gg', 'chat'],
      ['server map local my-arena', 'a map from desktop/maps'],
    ],
    notes: ['Type "quit" (or Ctrl+C) to end the match and close the host.'],
  },
  subcommands: SUBCOMMANDS,
  run: (args) => {
    if (args.length) throw new Error(`unknown "server ${args[0]}". Type "help server".`);
    printStatus();
  },
};

const sub = (n) => SUBCOMMANDS.find((s) => s.name === n);

export const serverShortcuts = [
  { name: 'who', server: true, usage: 'who', desc: 'Everyone in the hosted match (same as "server who")', run: sub('who').run },
  { name: 'kick', server: true, usage: 'kick <player>', desc: 'Same as "server kick"', run: sub('kick').run },
  { name: 'say', server: true, usage: 'say <text>', desc: 'Same as "server say"', rawLine: true, run: sub('say').run },
];

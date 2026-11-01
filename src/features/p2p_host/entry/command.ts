import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import type { CommandDefinition } from '#console/kernel/commands/registry.ts';
import { stringOf } from '#kernel/text/text-of.ts';
import {
  COMMAND_ALIASES, COMMAND_NAME, DIGITS_ONLY, LOCAL_MAP_PREFIX, LOCAL_WORD, MAP_FILE_EXTENSION, NO_VALUE, OWNER_COMMAND, PING_ACTIONS,
  PING_OFF, SEE_ALSO_MAPS, SLOT_PREFIX, WHO_COLUMNS, WORD_SEPARATOR,
} from '../keys.ts';
import { COMMAND_TEXT as TEXT, OWNER_LINE, SERVER_COMMAND_TEXT, SHORTCUT_TEXT, SUBCOMMAND_TEXT } from '../text.ts';
import {
  PHASE, dropLocalMap, hostPage, hostStatus, kick, ownerCommand, playerName, restart, roster, say, startAgain, stop, tell, useLocalMap, type RosterRow,
} from '../services/host.ts';

function findPlayer(word: string | undefined): RosterRow {
  if (!word) throw new Error(TEXT.whichPlayer);
  const rows = roster().filter((row) => !row.self);
  const wanted = stringOf(word).replace(SLOT_PREFIX, '').toLowerCase();
  if (DIGITS_ONLY.test(wanted)) {
    const bySlot = rows.find((row) => row.slot === Number(wanted));
    if (bySlot) return bySlot;
  }
  const exact = rows.filter((row) => row.nickname.toLowerCase() === wanted || row.login.toLowerCase() === wanted);
  if (exact.length === 1 && exact[0]) return exact[0];
  const starting = rows.filter((row) => row.nickname.toLowerCase().startsWith(wanted) || row.login.toLowerCase().startsWith(wanted));
  if (starting.length === 1 && starting[0]) return starting[0];
  if (starting.length > 1) throw new Error(TEXT.couldBe(word, starting.map(playerName)));
  throw new Error(TEXT.noPlayer(word));
}

function whoCells(row: RosterRow): string[] {
  return [
    String(row.slot),
    playerName(row) + (row.self ? TEXT.thisHost : '') + (row.guest ? TEXT.guest : ''),
    row.ping === undefined ? NO_VALUE : TEXT.pingMs(Math.round(row.ping as number)),
    row.spectator ? TEXT.spectator : stringOf(row.team ?? NO_VALUE),
    row.spectator ? NO_VALUE : String(Math.round((row.hp ?? 0) as number)),
    row.reputation === undefined ? NO_VALUE : stringOf(row.reputation),
  ];
}

function printWho(): void {
  const rows = roster();
  const status = hostStatus();
  if (!status.match) {
    print(TEXT.noMatch(status.phase), COLOR.notice);
    return;
  }
  const players = rows.filter((row) => !row.spectator && !row.self).length;
  const spectating = rows.filter((row) => row.spectator && !row.self).length;
  print(TEXT.whoHead(players, status.match.players_max, spectating), COLOR.title);
  const lines = rows.map(whoCells);
  const widths = WHO_COLUMNS.map((heading, index) => Math.max(heading.length, ...lines.map((line) => (line[index] ?? '').length)));
  const formatRow = (cells: readonly string[]): string => TEXT.row(cells.map((cell, index) => cell.padEnd(widths[index] ?? 0)));
  print(formatRow(WHO_COLUMNS), COLOR.hint);
  for (const line of lines) print(formatRow(line));
}

function printStatus(): void {
  const status = hostStatus();
  const { match: planned, server } = hostPage();
  print(TEXT.statusHead(status.phase, status.seconds, status.restartIn), COLOR.title);
  if (status.last && status.phase !== PHASE.running) print(TEXT.statusLast(status.last), COLOR.hint);
  const settings = status.settings || planned;
  print(TEXT.statusMatch(settings.title, settings.game_type, settings.max_players, !!settings.password));
  if (status.match) print(TEXT.statusMapLive(status.match.map_name, status.match.map_id, status.localMap));
  else print(TEXT.statusMapPlanned(settings.map_id, status.localMap));
  print(TEXT.statusRegion(settings.p2p_region));
  print(TEXT.statusAllow(server.allow));
  print(TEXT.statusHost(server.host_plays, server.fps, server.udp_ports, server.ice_servers.length));
  if (status.match) printWho();
}

const sendOwner = (text: string): void => {
  ownerCommand(text);
  print(TEXT.sent(text), COLOR.ok);
};
const owner = (text: string) => (): void => sendOwner(text);

function changeMap(args: string[]): void {
  const status = hostStatus();
  if (!args.length) {
    if (status.match) print(TEXT.mapNow(status.match.map_name, status.match.map_id, status.localMap));
    else print(TEXT.noMatch(status.phase), COLOR.notice);
    return;
  }
  if ((args[0] ?? '').toLowerCase() === LOCAL_WORD) {
    const name = args.slice(1).join(WORD_SEPARATOR).replace(LOCAL_MAP_PREFIX, '').replace(MAP_FILE_EXTENSION, '');
    if (!name) throw new Error(TEXT.mapLocalUsage);
    useLocalMap(name).catch((error: unknown) => print(TEXT.error((error as Error).message), COLOR.error));
    return;
  }
  const line = OWNER_LINE.map(args.join(WORD_SEPARATOR));
  const had = dropLocalMap();
  ownerCommand(line);
  print(TEXT.mapSent(line, had ? had.name : ''), COLOR.ok);
}

const runKick = (args: string[]): void => kick(findPlayer(args.join(WORD_SEPARATOR)));

function runTell(args: string[]): void {
  const row = findPlayer(args[0]);
  const text = args.slice(1).join(WORD_SEPARATOR);
  if (!text) throw new Error(TEXT.tellUsage);
  tell(row, text);
  print(TEXT.toPlayer(playerName(row), text), COLOR.ok);
}

function runSay(args: string[]): void {
  if (!args.length) throw new Error(TEXT.sayUsage);
  say(args.join(WORD_SEPARATOR));
}

function runPing(args: string[]): void {
  const word = (args[0] || '').toLowerCase();
  const ms = word === PING_OFF ? 0 : Number(word);
  if (!Number.isInteger(ms) || ms < 0) throw new Error(TEXT.pingUsage);
  sendOwner(OWNER_LINE.ping(ms));
}

function runPingAction(args: string[]): void {
  const action = args[0];
  if (action === undefined || !PING_ACTIONS.includes(action)) throw new Error(TEXT.pingActionUsage(PING_ACTIONS));
  sendOwner(OWNER_LINE.pingAction(action));
}

function runMinReputation(args: string[]): void {
  const reputation = Number(args[0]);
  if (!Number.isInteger(reputation) || reputation < 0) throw new Error(TEXT.minReputationUsage);
  sendOwner(OWNER_LINE.minReputation(reputation));
}

function runStop(): void {
  const wasRunning = stop();
  print(wasRunning ? TEXT.matchEnded : TEXT.stopped, COLOR.ok);
}

function runStart(): void {
  startAgain();
  print(TEXT.starting, COLOR.ok);
}

function runRestart(): void {
  restart();
  print(TEXT.restarting, COLOR.ok);
}

const SUBCOMMANDS: readonly CommandDefinition[] = Object.freeze([
  { name: COMMAND_NAME.status, aliases: COMMAND_ALIASES.status, ...SUBCOMMAND_TEXT.status, run: printStatus },
  { name: COMMAND_NAME.who, aliases: COMMAND_ALIASES.who, ...SUBCOMMAND_TEXT.who, run: printWho },
  { name: COMMAND_NAME.kick, ...SUBCOMMAND_TEXT.kick, run: runKick },
  { name: COMMAND_NAME.tell, aliases: COMMAND_ALIASES.tell, ...SUBCOMMAND_TEXT.tell, rawLine: true, run: runTell },
  { name: COMMAND_NAME.say, ...SUBCOMMAND_TEXT.say, rawLine: true, run: runSay },
  {
    name: COMMAND_NAME.map,
    usage: SUBCOMMAND_TEXT.map.usage,
    desc: SUBCOMMAND_TEXT.map.desc,
    help: { about: SUBCOMMAND_TEXT.map.about, examples: SUBCOMMAND_TEXT.map.examples, see: SEE_ALSO_MAPS },
    run: changeMap,
  },
  { name: COMMAND_NAME.pause, ...SUBCOMMAND_TEXT.pause, run: owner(OWNER_COMMAND.pause) },
  { name: COMMAND_NAME.swap, ...SUBCOMMAND_TEXT.swap, run: owner(OWNER_COMMAND.swap) },
  { name: COMMAND_NAME.endround, ...SUBCOMMAND_TEXT.endround, run: owner(OWNER_COMMAND.endround) },
  { name: COMMAND_NAME.unbanall, ...SUBCOMMAND_TEXT.unbanall, run: owner(OWNER_COMMAND.unbanall) },
  { name: COMMAND_NAME.ping, ...SUBCOMMAND_TEXT.ping, run: runPing },
  {
    name: COMMAND_NAME.pingAction, usage: SUBCOMMAND_TEXT.pingAction.usage(PING_ACTIONS), desc: SUBCOMMAND_TEXT.pingAction.desc, run: runPingAction,
  },
  { name: COMMAND_NAME.minReputation, aliases: COMMAND_ALIASES.minReputation, ...SUBCOMMAND_TEXT.minReputation, run: runMinReputation },
  { name: COMMAND_NAME.stop, ...SUBCOMMAND_TEXT.stop, run: runStop },
  { name: COMMAND_NAME.start, ...SUBCOMMAND_TEXT.start, run: runStart },
  { name: COMMAND_NAME.restart, ...SUBCOMMAND_TEXT.restart, run: runRestart },
]);

export const serverCommand: CommandDefinition = Object.freeze({
  name: COMMAND_NAME.server,
  server: true,
  usage: SERVER_COMMAND_TEXT.usage,
  desc: SERVER_COMMAND_TEXT.desc,
  help: { about: SERVER_COMMAND_TEXT.about, examples: SERVER_COMMAND_TEXT.examples, notes: SERVER_COMMAND_TEXT.notes },
  subcommands: SUBCOMMANDS,
  run: (args: string[]): void => {
    if (args.length) throw new Error(TEXT.unknownSubcommand(args[0]));
    printStatus();
  },
});

export const serverShortcuts: readonly CommandDefinition[] = Object.freeze([
  { name: COMMAND_NAME.who, server: true, ...SHORTCUT_TEXT.who, run: printWho },
  { name: COMMAND_NAME.kick, server: true, ...SHORTCUT_TEXT.kick, run: runKick },
  { name: COMMAND_NAME.say, server: true, ...SHORTCUT_TEXT.say, rawLine: true, run: runSay },
]);

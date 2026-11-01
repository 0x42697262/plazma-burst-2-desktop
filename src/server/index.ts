import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import https from 'node:https';
import crypto from 'node:crypto';
import readline from 'node:readline';
import { Server, type Socket } from 'socket.io';
import { createLogger } from '#kernel/log/logger.ts';
import { parseLogLevel } from '#kernel/config/log-level.ts';
import { REPO_ROOT, DESKTOP_DIR } from '#kernel/config/paths.ts';
import { makeUnpacker } from '#kernel/maps/map-text.ts';
import { findNames } from '#tools/find-names/find-names.ts';
import selfsigned from 'selfsigned';
import { stringOf } from '#kernel/text/text-of.ts';
import { BANS_INDENT, CERT_DAYS, CERT_KEY_SIZE, CLOSE_DELAY_MS, KEY_FILE_MODE, MATCH_NUMBER_WIDTH, NICKNAME_WIDTH, NOT_FOUND, OK, ADDRESS_WIDTH, PING_WIDTH } from './constants.ts';
import {
  ARG, BANS_FILE, CERT_ALGORITHM, CERT_FILE, CERT_NAME, CONFIG_FILE, CONNECTION_EVENT, DATA_FOLDER, ERROR_EVENT, GAME_DIR_VARIABLE, GAME_FOLDER, GET_METHOD,
  INTERRUPT_SIGNAL, IPV4, JSON_TYPE, KEY_FILE, LINE_EVENT, MAPS_FOLDER, NEEDED_NAMES, NO_STORE, ORIGIN, QUIT_WORDS, SPACE, STATUS_PATH, STRINGS_FILE,
  TEXT_ENCODING, VERSION_FILE, WORDS, LINE_JOIN, HEADER, SERVER_FOLDER,
} from './keys.ts';
import { SERVER_LOG as TEXT } from './text.ts';
import { loadConfig } from './config.ts';
import { createMaps } from './maps.ts';
import { GameServer } from './game.ts';

type Arguments = { config: string; game: string; data: string; help?: boolean };
type Tls = { cert: string; key: string; fingerprint: string };
type MatchRow = { map_name: string; game_type: string; players_current: number; players_max: number; spectators_current: number; has_password?: boolean };
type SelfSigned = { generate(attributes: unknown, options: unknown): { private: string; cert: string } };

const SERVER_DIR = path.join(REPO_ROOT, SERVER_FOLDER);
const FIRST_USER_ARGUMENT = 2;

function parseArgs(args: readonly string[]): Arguments {
  const parsed: Arguments = {
    config: path.join(SERVER_DIR, CONFIG_FILE),
    game: process.env[GAME_DIR_VARIABLE] || path.join(REPO_ROOT, GAME_FOLDER),
    data: path.join(SERVER_DIR, DATA_FOLDER),
  };
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    const next = (): string => path.resolve(args[++index] || '');
    if (arg === ARG.config) parsed.config = next();
    else if (arg === ARG.game) parsed.game = next();
    else if (arg === ARG.data) parsed.data = next();
    else if (arg === ARG.help || arg === ARG.helpShort) parsed.help = true;
  }
  return parsed;
}

function certificate(dataDir: string, log: ReturnType<typeof createLogger>): Tls {
  const certFile = path.join(dataDir, CERT_FILE);
  const keyFile = path.join(dataDir, KEY_FILE);
  if (!fs.existsSync(certFile) || !fs.existsSync(keyFile)) {
    const pems = (selfsigned as SelfSigned).generate(CERT_NAME, { keySize: CERT_KEY_SIZE, days: CERT_DAYS, algorithm: CERT_ALGORITHM });
    fs.mkdirSync(dataDir, { recursive: true });
    fs.writeFileSync(keyFile, pems.private, { mode: KEY_FILE_MODE });
    fs.writeFileSync(certFile, pems.cert);
    log.info(TEXT.madeCertificate(path.relative(REPO_ROOT, certFile)));
  }
  const cert = fs.readFileSync(certFile, TEXT_ENCODING);
  return { cert, key: fs.readFileSync(keyFile, TEXT_ENCODING), fingerprint: new crypto.X509Certificate(cert).fingerprint256 };
}

function readBans(dataDir: string): string[] {
  try {
    return JSON.parse(fs.readFileSync(path.join(dataDir, BANS_FILE), TEXT_ENCODING)) as string[];
  } catch {
    return [];
  }
}

function writeBans(dataDir: string, bans: readonly string[]): void {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, BANS_FILE), JSON.stringify(bans, null, BANS_INDENT) + LINE_JOIN);
}

function gameVersion(gameDir: string): string | null {
  try {
    return (JSON.parse(fs.readFileSync(path.join(gameDir, VERSION_FILE), TEXT_ENCODING)) as { version?: string }).version || null;
  } catch {
    return null;
  }
}

function addresses(): string[] {
  const found: string[] = [];
  for (const list of Object.values(os.networkInterfaces())) {
    for (const address of list ?? []) if (address.family === IPV4 && !address.internal) found.push(address.address);
  }
  return found;
}

function main(): void {
  const args = parseArgs(process.argv.slice(FIRST_USER_ARGUMENT));
  if (args.help) {
    console.log(TEXT.usage);
    return;
  }
  const dataDir = args.data;
  const log = createLogger(parseLogLevel(process.argv, process.env).level);
  const loaded = loadConfig(args.config);
  if (loaded.missing) log.info(TEXT.noConfig(path.relative(REPO_ROOT, args.config)));
  for (const problem of loaded.problems) log.warn(TEXT.configProblem(problem));
  if (loaded.errors.length || !loaded.server) {
    for (const error of loaded.errors) log.error(TEXT.configProblem(error));
    process.exitCode = 1;
    return;
  }
  const config = { ...loaded.server, bans: readBans(dataDir) };

  if (!fs.existsSync(path.join(args.game, STRINGS_FILE))) {
    log.error(TEXT.noGame(args.game));
    process.exitCode = 1;
    return;
  }
  const found = findNames(args.game);
  const missing = NEEDED_NAMES.filter((key) => !found.found[key]);
  if (missing.length) {
    log.error(TEXT.notRecognised(missing));
    process.exitCode = 1;
    return;
  }
  const maps = createMaps({ mapsDir: path.join(DESKTOP_DIR, MAPS_FOLDER), cacheDir: path.join(dataDir, MAPS_FOLDER), unpack: makeUnpacker(args.game) });
  const game = new GameServer({ gameDir: args.game, names: found.found, config, log, maps });
  game.onBans = (bans) => { writeBans(dataDir, bans); };

  const tls = certificate(dataDir, log);
  const version = gameVersion(args.game);
  const status = (): string => JSON.stringify({
    name: config.name, description: config.description, version, password: !!config.password,
    players: game.online().length, max_players: config.max_players, matches: game.matches().length,
  });
  const web = https.createServer({ cert: tls.cert, key: tls.key }, (request, response) => {
    if (request.method === GET_METHOD && request.url === STATUS_PATH) {
      const body = status();
      response.writeHead(OK, { [HEADER.contentType]: JSON_TYPE, [HEADER.contentLength]: Buffer.byteLength(body), [HEADER.cache]: NO_STORE });
      response.end(body);
      return;
    }
    response.writeHead(NOT_FOUND);
    response.end();
  });
  const io = new Server(web, { cors: { origin: ORIGIN, credentials: true }, serveClient: false });
  io.on(CONNECTION_EVENT, (socket: Socket) => {
    try {
      game.accept(socket as unknown as Parameters<GameServer['accept']>[0]);
    } catch (error) {
      log.error(TEXT.connectionFailed((error as Error).message));
      socket.disconnect(true);
    }
  });
  web.on(ERROR_EVENT, (error: Error) => {
    log.error(TEXT.cannotListen(config.bind, config.port, error.message));
    process.exit(1);
  });

  function printJoin(): void {
    const [first, ...others] = addresses();
    log.info(TEXT.joinTitle);
    log.info(TEXT.joinAddress(first, config.port));
    log.info(TEXT.joinFingerprint(tls.fingerprint));
    log.info(TEXT.joinPassword(!!config.password));
    if (others.length) log.info(TEXT.otherAddresses(others));
    log.info(TEXT.fromOutside(config.port));
  }

  web.listen(config.port, config.bind, () => {
    game.start();
    const address = web.address();
    if (address && typeof address === 'object') config.port = address.port;
    log.info(TEXT.listening(config.name, config.bind, config.port, !!config.password, version));
    printJoin();
    log.info(TEXT.typeHelp);
  });

  const listMatches = (): void => {
    const all = game.matches();
    if (!all.length) {
      log.info(TEXT.noMatches);
      return;
    }
    all.forEach((match, index) => {
      const row = match as unknown as MatchRow;
      log.info(TEXT.matchRow(String(index + 1).padStart(MATCH_NUMBER_WIDTH), match.title, match.map_id, row.map_name, row.game_type, row.players_current, row.players_max, row.spectators_current, !!row.has_password));
    });
  };
  const listOnline = (): void => {
    const all = game.online();
    if (!all.length) {
      log.info(TEXT.nobodyOnline);
      return;
    }
    for (const player of all) {
      const ping = String(Math.round((player.ping as number | undefined) ?? 0)).padStart(PING_WIDTH);
      const place = player.match ? TEXT.inMatch(player.match.title) : TEXT.inLobby;
      log.info(TEXT.whoRow(player.nickname.padEnd(NICKNAME_WIDTH), stringOf(player.ip).padEnd(ADDRESS_WIDTH), ping, place, player.admin));
    }
  };
  const commands: Record<string, (rest: string) => void> = {
    help: () => { for (const line of TEXT.help) log.info(line); },
    status: () => {
      log.info(TEXT.status(game.online().length, game.matches().length));
      listMatches();
    },
    who: listOnline,
    players: listOnline,
    matches: listMatches,
    say: (rest) => {
      if (!rest) throw new Error(TEXT.sayUsage);
      game.say(rest);
      log.info(TEXT.said(rest));
    },
    kick: (rest) => { log.info(TEXT.kicked(game.kick(rest))); },
    ban: (rest) => { log.info(TEXT.banned(game.ban(rest))); },
    unban: (rest) => { log.info(game.unban(rest) ? TEXT.unbanned(rest) : TEXT.notBanned(rest)); },
    bans: () => {
      const bans = [...game.bans];
      log.info(bans.length ? TEXT.bans(bans) : TEXT.nobodyBanned);
    },
    end: (rest) => { log.info(TEXT.ended(game.endMatch(rest).title)); },
    map: (rest) => {
      const [which, ...id] = rest.split(WORDS);
      if (!which || !id.length) throw new Error(TEXT.mapUsage);
      void game.setMap(which, id.join(SPACE)).then(({ match, ok, message }) => { log.info(ok ? TEXT.mapChanged(match.title, match.map_id) : TEXT.mapNotChanged(message)); });
    },
    join: printJoin,
  };

  let closing = false;
  const quit = (): void => {
    if (closing) process.exit(0);
    closing = true;
    log.info(TEXT.closing);
    announceClosing();
    setTimeout(() => {
      game.stop();
      void io.close();
      process.exit(0);
    }, CLOSE_DELAY_MS);
  };
  function announceClosing(): void {
    try {
      game.say(TEXT.closingAnnouncement);
    } catch {
      return;
    }
  }
  const terminal = readline.createInterface({ input: process.stdin, terminal: false });
  terminal.on(LINE_EVENT, (line: string) => {
    const text = line.trim();
    if (!text) return;
    const [word = '', ...rest] = text.split(WORDS);
    const lowered = word.toLowerCase();
    if (QUIT_WORDS.includes(lowered)) {
      quit();
      return;
    }
    const command = commands[lowered];
    if (!command) {
      log.info(TEXT.unknownCommand(word));
      return;
    }
    try {
      command(rest.join(SPACE));
    } catch (error) {
      log.info(TEXT.error((error as Error).message));
    }
  });
  process.on(INTERRUPT_SIGNAL, quit);
}

main();

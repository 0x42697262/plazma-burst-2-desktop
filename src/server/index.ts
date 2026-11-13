import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';
import crypto from 'node:crypto';
import readline from 'node:readline';
import { Server, type Socket } from 'socket.io';
import { createLogger } from '#kernel/log/logger.ts';
import { parseLogLevel } from '#kernel/config/log-level.ts';
import { CLIENT_PATHS, REPO_ROOT, SERVER_DATA_DIR } from '#kernel/config/paths.ts';
import { NOTHING_MOVED, moveLegacyData, tellMoveReport } from '#kernel/data/move.ts';
import { makeUnpacker } from '#kernel/maps/map-text.ts';
import { findNames } from '#tools/find-names/find-names.ts';
import selfsigned from 'selfsigned';
import { stringOf } from '#kernel/text/text-of.ts';
import { BANS_INDENT, CERT_DAYS, CERT_KEY_SIZE, CLOSE_DELAY_MS, KEY_FILE_MODE, MATCH_NUMBER_WIDTH, NICKNAME_WIDTH, NOT_FOUND, OK, ADDRESS_WIDTH, PING_WIDTH } from './constants.ts';
import {
  ARG, BANS_FILE, CERT_ALGORITHM, CERT_FILE, CERT_NAME, CONFIG_FILE, CONNECTION_EVENT, ERROR_EVENT, GAME_DIR_VARIABLE, GAME_FOLDER, GET_METHOD,
  INTERRUPT_SIGNAL, IPV4, JSON_TYPE, KEY_FILE, LINE_EVENT, MAP_SOURCE, NEEDED_NAMES, NO_STORE, ORIGIN, QUIT_WORDS, SADBURST_MAPS, SITE_MAPS, SPACE, STATUS_PATH, STRINGS_FILE,
  TEXT_ENCODING, VERSION_FILE, WORDS, LINE_JOIN, HEADER,
} from './keys.ts';
import { SERVER_LOG as TEXT } from './text.ts';
import { loadConfig } from './config.ts';
import { createMaps, httpMapSource, type MapSource } from './maps.ts';
import type { MapSourceSetting } from './config.ts';
import { GameServer } from './game.ts';
import { clientAddressOf } from './proxy.ts';
import { enabledServerFeatures } from './features.ts';
import type { HttpHandler, ServerFeatureContext } from './feature-types.ts';
import { CATALOG } from '#shared/features/catalog.ts';
import { CLIENT, MODE } from '#shared/features/keys.ts';
import { EDITION } from '#shared/editions/constants.ts';
import { resolveFlags } from '#kernel/flags/resolve.ts';
import { parseEnvironment } from '#kernel/config/environment.ts';

type Arguments = { config: string; game: string; data: string; help?: boolean };
type Tls = { cert: string; key: string; fingerprint: string };
type MatchRow = { map_name: string; game_type: string; players_current: number; players_max: number; spectators_current: number; has_password?: boolean };
type SelfSigned = { generate(attributes: unknown, options: unknown): { private: string; cert: string } };

const FIRST_USER_ARGUMENT = 2;

function parseArgs(args: readonly string[]): Arguments {
  const parsed: Arguments = {
    config: path.join(SERVER_DATA_DIR, CONFIG_FILE),
    game: process.env[GAME_DIR_VARIABLE] || path.join(REPO_ROOT, GAME_FOLDER),
    data: SERVER_DATA_DIR,
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

type SourceMakers = Readonly<Record<string, ((setting: MapSourceSetting) => MapSource) | undefined>>;

const HTTP_SOURCES: SourceMakers = Object.freeze({
  [MAP_SOURCE.site]: () => httpMapSource(MAP_SOURCE.site, SITE_MAPS),
  [MAP_SOURCE.sadburst]: () => httpMapSource(MAP_SOURCE.sadburst, SADBURST_MAPS),
  [MAP_SOURCE.http]: (setting) => httpMapSource(setting.url ?? MAP_SOURCE.http, setting.url ?? ''),
});

function mapSourcesOf(settings: readonly MapSourceSetting[], makers: SourceMakers): { sources: MapSource[]; unavailable: string[]; failed: string[] } {
  const sources: MapSource[] = [];
  const unavailable: string[] = [];
  const failed: string[] = [];
  for (const setting of settings) {
    const make = makers[setting.type];
    if (!make) {
      unavailable.push(setting.type);
      continue;
    }
    try {
      sources.push(make(setting));
    } catch (error) {
      failed.push((error as Error).message);
    }
  }
  return { sources, unavailable, failed };
}

function main(): void {
  const args = parseArgs(process.argv.slice(FIRST_USER_ARGUMENT));
  if (args.help) {
    console.log(TEXT.usage);
    return;
  }
  const dataDir = args.data;
  const usesTheDefaultDataFolder = dataDir === SERVER_DATA_DIR;
  const dataMove = usesTheDefaultDataFolder ? moveLegacyData(REPO_ROOT) : NOTHING_MOVED;
  const log = createLogger(parseLogLevel(process.argv, process.env).level);
  tellMoveReport(dataMove, log);
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
    log.error(TEXT.notRecognized(missing));
    process.exitCode = 1;
    return;
  }
  const environment = parseEnvironment(process.argv, process.env);
  for (const problem of environment.problems) log.warn(problem);
  const flags = resolveFlags({
    catalog: CATALOG, fileOverrides: {}, fileUnknownIds: [], envToggles: environment.environment.featureToggles, mode: MODE.lobby, client: CLIENT.official, edition: EDITION,
  });
  for (const problem of flags.problems) log.warn(problem);
  const features = enabledServerFeatures(flags.states);
  const featureContext: ServerFeatureContext = Object.freeze({ config, gameDir: args.game, dataDir, names: found.found, log });
  const sourceMakers: SourceMakers = Object.freeze(Object.fromEntries([
    ...Object.entries(HTTP_SOURCES),
    ...features.flatMap((feature) => Object.entries(feature.mapSources?.(featureContext) ?? {})),
  ]));
  const httpHandlers: HttpHandler[] = features.flatMap((feature) => (feature.http ? [feature.http(featureContext)] : []));
  const chosenSources = mapSourcesOf(config.download_maps ? config.map_sources : [], sourceMakers);
  if (chosenSources.unavailable.length || chosenSources.failed.length) {
    if (chosenSources.unavailable.length) log.error(TEXT.sourcesUnavailable(chosenSources.unavailable));
    for (const message of chosenSources.failed) log.error(message);
    process.exitCode = 1;
    return;
  }
  const maps = createMaps({ mapsDir: CLIENT_PATHS.official.mapsDir, unpack: makeUnpacker(args.game), sources: chosenSources.sources });
  const game = new GameServer({ gameDir: args.game, names: found.found, config, log, maps });
  game.onBans = (bans) => { writeBans(dataDir, bans); };

  const tls = config.behind_proxy ? null : certificate(dataDir, log);
  const version = gameVersion(args.game);
  const status = (): string => JSON.stringify({
    name: config.name, description: config.description, version, password: !!config.password,
    players: game.online().length, max_players: config.max_players, matches: game.matches().length,
  });
  const answer = (request: http.IncomingMessage, response: http.ServerResponse): void => {
    if (request.method === GET_METHOD && request.url === STATUS_PATH) {
      const body = status();
      response.writeHead(OK, { [HEADER.contentType]: JSON_TYPE, [HEADER.contentLength]: Buffer.byteLength(body), [HEADER.cache]: NO_STORE });
      response.end(body);
      return;
    }
    if (httpHandlers.some((handle) => handle(request, response))) return;
    response.writeHead(NOT_FOUND);
    response.end();
  };
  const web = tls ? https.createServer({ cert: tls.cert, key: tls.key }, answer) : http.createServer(answer);
  const origins = [ORIGIN, ...(config.public_url ? [new URL(config.public_url).origin] : [])];
  const io = new Server(web, { cors: { origin: origins, credentials: true }, serveClient: false });
  io.on(CONNECTION_EVENT, (socket: Socket) => {
    try {
      if (config.behind_proxy) socket.handshake.address = clientAddressOf(socket.handshake.headers, socket.handshake.address);
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
    if (!tls) {
      log.info(TEXT.behindProxy(config.public_url));
      return;
    }
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

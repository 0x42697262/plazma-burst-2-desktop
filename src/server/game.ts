import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import type { Logger } from '#kernel/log/logger.ts';
import { stringOf } from '#kernel/text/text-of.ts';
import { CHEAT_DETAIL_LENGTH, FIRST_UID, GAME_MATCH_LIST_GAP_MS, KICK_DELAY_MS, MAX_MAP_PLAYERS, MAX_NICKNAME, NEVER_LISTED, REPUTATION, TICK_MS, WELCOME_DELAY_MS } from './constants.ts';
import {
  ACCOUNT_KEY, CALL_USE, DEFAULT_SKIN_PART, DOLLAR, ESCAPED_DOLLAR, ESCAPED_LESS_THAN, GUEST_LOGIN, HTML_ENTITY, HTML_TAG, IPV6_PREFIX, KICK_ON_CHEAT,
  LESS_THAN, LIST_USES, LOG_MEMBER, MAP_FAILED, MAP_ID_SEPARATOR, MAP_JOIN, MAP_METHOD, MAP_NOT_APPROVED, MAP_REQUEST_NAME, MAP_SPLIT, NICKNAME_CHARACTERS,
  NUMBER_MARK, PAGE_LOCATION, PLAYER_START, RANDOM_MAPS, REALM_SOURCE, SCRIPTS, SHAPE, SITE_MAPS, TEXT_ENCODING, USER_AGENT, announcement, memberPattern,
  type Shape, type ServerNameKey, LINE_JOIN, HTML_CHARACTER,
} from './keys.ts';
import { GAME_LOG as LOG, GAME_TEXT as TEXT } from './text.ts';
import type { ServerConfig } from './config.ts';
import type { Maps } from './maps.ts';

type Bag = Record<string, unknown>;
type Callable = (...args: unknown[]) => unknown;
type Names = Readonly<Record<string, string>>;
type Connection = Bag & { ip?: string; ping?: number; Disconnect: () => void };
type Match = Bag & { title: string; uid: number; map_id: string };
type Network = Bag & { connections: Connection[]; matches?: Match[] };
type AccountRecord = { connection: Connection | null; login: string; entry: { login: string; nickname: string; reputation: number } | null };
type Realm = { Map: MapConstructor; Array: ArrayConstructor };
export type OnlinePlayer = { conn: Connection; nickname: string; ip: unknown; ping: unknown; match: Match | null; admin: boolean };
export type GameServerOptions = { gameDir: string; names: Names; config: ServerConfig & { bans: readonly string[] }; log: Logger; maps: Maps };

export function memberShapes(source: string, objectName: string): Record<string, Shape> {
  const shapes: Record<string, Shape> = {};
  for (const match of source.matchAll(memberPattern(objectName.replace(DOLLAR, ESCAPED_DOLLAR)))) {
    const member = match[1] ?? '';
    const use = match[2] ?? '';
    const shape: Shape = MAP_METHOD.test(use) ? SHAPE.map : LIST_USES.includes(use) ? SHAPE.list : use === CALL_USE ? SHAPE.function : SHAPE.value;
    if (!shapes[member] || shapes[member] === SHAPE.value) shapes[member] = shape;
  }
  return shapes;
}

function nothing(): Callable {
  const stand: Callable = new Proxy(() => undefined, {
    get: (_target, key) => (key === Symbol.toPrimitive ? () => '' : stand),
    apply: () => undefined,
  });
  return stand;
}

const plainText = (html: unknown): string => stringOf(html ?? '').replace(HTML_TAG, '')
  .replace(HTML_ENTITY.lessThan, HTML_CHARACTER.lessThan).replace(HTML_ENTITY.greaterThan, HTML_CHARACTER.greaterThan).replace(HTML_ENTITY.ampersand, HTML_CHARACTER.ampersand);

const callQuietly = (action: () => void): void => {
  try {
    action();
  } catch {
    return;
  }
};

export class GameServer {
  readonly gameDir: string;
  readonly names: Names;
  readonly config: GameServerOptions['config'];
  readonly log: Logger;
  readonly maps: Maps;
  readonly bans: Set<string>;
  onBans: ((bans: string[]) => void) | null = null;
  private nextUid = FIRST_UID;
  private timer: ReturnType<typeof setInterval> | null = null;
  private context: Bag = {};
  private net: Network = { connections: [] };
  private Conn: new (options: Bag) => Connection = class {} as unknown as new (options: Bag) => Connection;
  private accountModule: Bag = {};

  constructor({ gameDir, names, config, log, maps }: GameServerOptions) {
    this.gameDir = gameDir;
    this.names = names;
    this.config = config;
    this.log = log;
    this.maps = maps;
    this.bans = new Set(config.bans.map((ban) => ban.toLowerCase()));
    this.load();
  }

  private name(key: ServerNameKey): string {
    return this.names[key] ?? '';
  }

  run(code: string): unknown {
    return vm.runInContext(code, this.context);
  }

  private load(): void {
    const log = this.log;
    const context: Bag = {
      console: {
        log: (...parts: unknown[]) => { log.debug(LOG.game, ...parts); },
        warn: (...parts: unknown[]) => { log.debug(LOG.gameWarning, ...parts); },
        error: (...parts: unknown[]) => { log.warn(LOG.gameError, ...parts); },
        info: () => undefined,
        debug: () => undefined,
      },
      setTimeout, clearTimeout, setInterval, clearInterval, performance, URL, URLSearchParams, TextEncoder, TextDecoder,
      location: { ...PAGE_LOCATION },
      navigator: { userAgent: USER_AGENT },
    };
    context.globalThis = context;
    context.window = context;
    vm.createContext(context);
    this.context = context;
    const sources = SCRIPTS.map((relative) => [relative, fs.readFileSync(path.join(this.gameDir, relative), TEXT_ENCODING)] as const);
    for (const [relative, source] of sources) vm.runInContext(source, context, { filename: relative });
    context.trace = (...parts: unknown[]) => { log.debug(LOG.trace, ...parts); };
    context.ChatNewMsg = (message: unknown) => { log.debug(LOG.gameChat, plainText(message)); };
    context.TRACK_MP_LOGS = false;
    context.ReportCaughtError = (error: unknown) => { log.warn(LOG.gameError, error instanceof Error ? error.message : stringOf(error)); };
    context.HUD = nothing();

    this.net = this.run(this.name('net')) as Network;
    this.Conn = this.run(this.name('connClass')) as new (options: Bag) => Connection;
    this.net[this.name('serverFlag')] = true;
    ((this.run(this.name('setupClass')) as Bag)[this.name('setupMethod')] as Callable)(null, null);

    const code = sources.map(([, source]) => source).join(LINE_JOIN);
    context[this.name('p2pAuth')] = this.accounts(code);
    context[this.name('serverStats')] = nothing();
    context[this.name('webRequests')] = { [this.name('webRequest')]: (_owner: unknown, _url: unknown, _method: unknown, fields: Bag | null, done: (answer: string) => void) => { this.mapRequest(fields, done); } };
    context[this.name('mapUrl')] = SITE_MAPS;
    context[this.name('mapKey')] = '';
    context[this.name('mapRequest')] = MAP_REQUEST_NAME;
  }

  private records(): Map<number, AccountRecord> {
    return this.accountModule[this.name('authRecords')] as Map<number, AccountRecord>;
  }

  private authIds(): WeakMap<object, { id: number }> {
    return this.accountModule[this.name('p2pAuthIds')] as WeakMap<object, { id: number }>;
  }

  private accounts(code: string): Bag {
    const realm = this.run(REALM_SOURCE) as Realm;
    const accounts: Bag = {};
    for (const [member, shape] of Object.entries(memberShapes(code, this.name('p2pAuth')))) {
      accounts[member] = shape === SHAPE.map ? new realm.Map() : shape === SHAPE.list ? new realm.Array() : shape === SHAPE.function ? () => undefined : LOG_MEMBER(member);
    }
    accounts[this.name('p2pAuthIds')] = new WeakMap();
    accounts[this.name('authRecords')] = new realm.Map();
    accounts[this.name('authLogin')] = (connection: Connection, _version: unknown, _hash: unknown, login: unknown, password: unknown, _uid: unknown, _device: unknown, _build: unknown, done: (why: string | null) => void) => {
      let why: string | null;
      try {
        why = this.login(connection, stringOf(login ?? ''), stringOf(password ?? ''));
      } catch (error) {
        why = TEXT.serverError((error as Error).message);
      }
      done(why);
    };
    accounts[this.name('authReport')] = () => TEXT.noReputation;
    accounts[this.name('authEndorse')] = () => TEXT.noReputation;
    accounts[this.name('authBan')] = (targetId: number) => {
      const record = (accounts[this.name('authRecords')] as Map<number, AccountRecord>).get(targetId);
      if (!record) return TEXT.notOnline;
      this.ban(record.login, TEXT.bannedByAdmin);
      return TEXT.userBanned;
    };
    accounts[this.name('authCheat')] = (connection: Connection, reason: unknown, cheatCode: unknown, detail: unknown) => { this.cheatReport(connection, reason, cheatCode, detail); };
    accounts[this.name('authLog')] = (connection: Connection, kind: unknown, text: unknown, match: Match | null) => { this.event(connection, kind, text, match); };
    this.accountModule = accounts;
    return accounts;
  }

  login(connection: Connection, login: string, password: string): string | null {
    const config = this.config;
    const nickname = login.trim();
    const key = nickname.toLowerCase();
    const adminSecret = Object.hasOwn(config.admin_secrets, key) ? config.admin_secrets[key] : undefined;
    if (adminSecret !== undefined && password !== adminSecret) return TEXT.adminNeedsSecret;
    if (adminSecret === undefined && config.password && password !== config.password) return TEXT.wrongPassword;
    if (!nickname || nickname === GUEST_LOGIN) return TEXT.needsNickname;
    if (nickname.length > MAX_NICKNAME || !NICKNAME_CHARACTERS.test(nickname)) return TEXT.badNickname(MAX_NICKNAME);
    if (adminSecret === undefined && config.nicknames.length && !config.nicknames.includes(key)) return TEXT.notListed;
    if (this.bans.has(key) || (connection.ip && this.bans.has(connection.ip))) return TEXT.banned;
    if (this.online().some((player) => player.nickname.toLowerCase() === key)) return TEXT.alreadyPlaying;
    if (this.online().length >= config.max_players) return TEXT.full;

    const uid = this.nextUid++;
    const isStaff = config.admins.includes(key);
    connection[this.name('connUser')] = {
      nickname, login: nickname, login_proof: '', uid, mdl: String(config.skin), mdl2: DEFAULT_SKIN_PART, is_staff: isStaff, is_guest: false,
      is_vpn: false, is_public_supporter: false, support_months: 0,
    };
    connection[this.name('connStats')] = { reputation: REPUTATION, key: ACCOUNT_KEY(key), skill: 0, wins: 0, loses: 0 };
    connection[this.name('connDevice')] = { [this.name('deviceId')]: () => null };
    this.authIds().set(connection, { id: uid });
    this.records().set(uid, { connection, login: nickname, entry: { login: nickname, nickname, reputation: REPUTATION } });
    this.log.info(LOG.loggedIn(nickname, connection.ip ?? '', isStaff));
    if (config.welcome) {
      setTimeout(() => {
        if (!connection[this.name('connClosed')]) (connection[this.name('connSay')] as Callable)(config.welcome);
      }, WELCOME_DELAY_MS);
    }
    return null;
  }

  private whoIs(connection: Connection | null | undefined): string {
    const user = connection?.[this.name('connUser')] as { nickname: string } | undefined;
    return user ? user.nickname : stringOf(connection?.ip);
  }

  event(connection: Connection | null, kind: unknown, text: unknown, match: Match | null): void {
    const accounts = this.accountModule;
    const who = this.whoIs(connection);
    const where = match ? LOG.where(plainText(match.title)) : '';
    const isKind = (key: ServerNameKey): boolean => kind === accounts[this.name(key)];
    if (isKind('logChat')) this.log.info(LOG.chat(where, who, plainText(text)));
    else if (isKind('logCreate')) this.log.info(LOG.created(who, where));
    else if (isKind('logJoin')) this.log.info(LOG.joined(who, where));
    else if (isKind('logSpectate')) this.log.info(LOG.spectating(who, where));
    else if (isKind('logLeave')) this.log.info(LOG.left(who, where));
    else if (isKind('logDisconnect')) {
      if (connection?.[this.name('connUser')]) this.log.info(LOG.disconnected(who, stringOf(connection[this.name('connReason')] ?? '')));
      this.forget(connection);
    } else this.log.debug(LOG.event(stringOf(kind), who, where, plainText(text)));
  }

  forget(connection: Connection | null): void {
    const record = connection ? this.authIds().get(connection) : undefined;
    const known = record ? this.records().get(record.id) : undefined;
    if (record && known) this.records().set(record.id, { connection: null, login: known.login, entry: null });
  }

  cheatReport(connection: Connection | null, reason: unknown, cheatCode: unknown, detail: unknown): void {
    const detailText = detail ? stringOf(detail).slice(0, CHEAT_DETAIL_LENGTH) : '';
    this.log.warn(LOG.cheat(this.whoIs(connection), reason === undefined || reason === null ? LOG.cheatCode(cheatCode) : stringOf(reason), detailText));
    if (this.config.cheat_reports === KICK_ON_CHEAT && connection) this.kickConnection(connection, TEXT.cheatKick);
  }

  randomMap(title: string): string | null {
    const pool = this.config.random_maps.length ? this.config.random_maps : this.maps.list();
    const playing = this.matches().find((match) => match.title === title)?.map_id;
    const choices = pool.length > 1 ? pool.filter((id) => id !== playing) : pool;
    return choices.length ? choices[Math.floor(Math.random() * choices.length)] ?? null : null;
  }

  mapRequest(fields: Bag | null, done: (answer: string) => void): void {
    const [asked = '', , title = ''] = stringOf(fields?.data ?? '').split(MAP_SPLIT);
    const fail = (why: string): string => [MAP_FAILED, why].join(MAP_JOIN);
    let id = asked;
    const answer = (text: string): string => {
      const starts = (text.match(PLAYER_START) ?? []).length;
      const players = Math.min(MAX_MAP_PLAYERS, starts || MAX_MAP_PLAYERS);
      return [text, id, MAP_NOT_APPROVED, String(players), id].join(MAP_JOIN);
    };
    const resolve = async (): Promise<string> => {
      if (RANDOM_MAPS.includes(asked.trim().toLowerCase())) {
        const picked = this.randomMap(title);
        if (!picked) return fail(TEXT.noRandomMaps(asked));
        id = picked;
        this.log.info(LOG.randomMap(asked, id));
      } else if (asked.includes(MAP_ID_SEPARATOR)) {
        return fail(TEXT.noMerging);
      }
      const local = this.maps.local(id);
      if (local) {
        this.log.info(LOG.localMap(id));
        return answer(local);
      }
      if (!this.config.download_maps) return fail(TEXT.notDownloading(id));
      let text: string | null;
      try {
        text = await this.maps.download(id);
      } catch (error) {
        this.log.warn(LOG.siteUnreachable(id, (error as Error).message));
        return fail(TEXT.siteUnreachable(id, (error as Error).message));
      }
      if (!text) {
        this.log.info(LOG.missingMap(id));
        return fail(TEXT.noSuchMap(id));
      }
      this.log.info(LOG.downloadedMap(id));
      return answer(text);
    };
    resolve().then(done, (error: unknown) => {
      this.log.warn(LOG.mapFailed(id, (error as Error).message));
      done(fail(TEXT.mapNotLoaded(id)));
    });
  }

  accept(socket: Bag & { conn: unknown; handshake: { address?: string } }): Connection {
    Object.defineProperty(socket, this.name('socketConn'), { get: () => socket.conn, configurable: true });
    const ip = stringOf(socket.handshake.address || '').replace(IPV6_PREFIX, '');
    const connection = new this.Conn({ socket, ip });
    const gap = this.config.match_list_gap_ms;
    let listedAt = NEVER_LISTED;
    Object.defineProperty(connection, this.name('connListAt'), {
      get: () => (gap === 0 ? NEVER_LISTED : listedAt + gap - GAME_MATCH_LIST_GAP_MS),
      set: (time: number) => { listedAt = time; },
      configurable: true,
    });
    this.net.connections.push(connection);
    this.log.debug(LOG.connection(ip));
    return connection;
  }

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => {
      try {
        (this.net[this.name('netTick')] as Callable)(Date.now());
      } catch (error) {
        this.log.error(LOG.tickFailed((error as Error).stack ?? (error as Error).message));
      }
    }, TICK_MS);
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  online(): OnlinePlayer[] {
    return this.net.connections
      .filter((connection) => connection[this.name('connUser')] && !connection[this.name('connClosed')])
      .map((connection) => {
        const user = connection[this.name('connUser')] as { nickname: string; is_staff?: boolean };
        return {
          conn: connection, nickname: user.nickname, ip: connection.ip, ping: connection.ping,
          match: (connection[this.name('connMatch')] as Match | undefined) || null, admin: !!user.is_staff,
        };
      });
  }

  matches(): Match[] {
    return this.net.matches || [];
  }

  find(word: string): OnlinePlayer {
    const wanted = stringOf(word || '').toLowerCase();
    const everyone = this.online();
    const exact = everyone.filter((player) => player.nickname.toLowerCase() === wanted);
    const [onlyExact] = exact;
    if (exact.length === 1 && onlyExact) return onlyExact;
    const starting = everyone.filter((player) => player.nickname.toLowerCase().startsWith(wanted));
    const [onlyStarting] = starting;
    if (starting.length === 1 && onlyStarting) return onlyStarting;
    throw new Error(starting.length ? TEXT.ambiguous(word, starting.map((player) => player.nickname)) : TEXT.nobodyCalled(word));
  }

  kickConnection(connection: Connection, why: string): void {
    callQuietly(() => { (connection[this.name('connSay')] as Callable)(why); });
    setTimeout(() => { connection.Disconnect(); }, KICK_DELAY_MS);
  }

  kick(word: string, why: string = TEXT.adminKick): string {
    const player = this.find(word);
    this.kickConnection(player.conn, why);
    return player.nickname;
  }

  ban(word: string, why: string = TEXT.adminBan): string {
    let name = stringOf(word || '').trim();
    callQuietly(() => {
      const player = this.find(word);
      name = player.nickname;
      this.kickConnection(player.conn, TEXT.youAre(why));
    });
    if (!name) throw new Error(TEXT.banWhom);
    this.bans.add(name.toLowerCase());
    this.onBans?.([...this.bans]);
    return name;
  }

  unban(word: string): boolean {
    const had = this.bans.delete(stringOf(word || '').trim().toLowerCase());
    if (had) this.onBans?.([...this.bans]);
    return had;
  }

  say(text: string): void {
    for (const player of this.online()) (player.conn[this.name('connSay')] as Callable)(announcement(text.replace(LESS_THAN, ESCAPED_LESS_THAN)));
  }

  match(word: string): Match {
    const everyMatch = this.matches();
    const number = Number(stringOf(word).replace(NUMBER_MARK, ''));
    const found = everyMatch.find((match) => match.uid === number) ?? everyMatch[number - 1];
    if (!found) throw new Error(TEXT.noMatch(word));
    return found;
  }

  endMatch(word: string): Match {
    const found = this.match(word);
    (found[this.name('matchEnd')] as Callable)(TEXT.matchEnded);
    return found;
  }

  setMap(word: string, id: string): Promise<{ match: Match; ok: boolean; message: string }> {
    const found = this.match(word);
    return new Promise((resolve) => {
      (found[this.name('matchLoadMap')] as Callable)(id, (ok: boolean, message: string) => { resolve({ match: found, ok, message }); });
    });
  }
}

export { SCRIPTS };

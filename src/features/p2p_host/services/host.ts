import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { stripHtml } from '#console/kernel/core/words.ts';
import { SERVER } from '#console/kernel/core/mode.ts';
import { game, NET, type SlotInfo } from '#console/kernel/game/bindings.ts';
import { HTTP_METHOD, MAP_MARKER, NO_STORE_CACHE } from '#shared/contract/keys.ts';
import { stringOf } from '#kernel/text/text-of.ts';
import { AWAY_MS, KICK_AGAIN_MS, MILLISECONDS_PER_SECOND, RESTART_PAUSE_MS, SLOW_MS, SPECTATE_RETRY_MS, TICK_MS } from '../constants.ts';
import {
  BYTE_ORDER_MARK, KICK_DONE, KICK_KEEP_OUT, LOCAL_MAP_ID_PREFIX, MAP_NOT_COMPRESSED, MAP_REQUEST_KIND, MAP_START, MAP_URL, OWNER_COMMAND, PHASE,
  type Phase, PLAYER_START, REPLY_OK, SCREEN, TIME_ZONE_SEPARATOR,
} from '../keys.ts';
import { DRIVER_TEXT as TEXT } from '../text.ts';
import type { Match, ServerSettings } from '../domain/config.ts';

export { PHASE };

export type HostPage = { match: Match; server: ServerSettings };
type Account = { login?: unknown; nickname?: string; is_guest?: boolean };
type Reply = readonly unknown[];
type HostedMatch = Record<string, unknown>;
type LocalMap = { name: string; text: string; players: number };
export type RosterRow = SlotInfo & { connection: unknown; slot: number; self: boolean };
export type HostStatus = {
  phase: Phase;
  seconds: number;
  last: string;
  settings: Match | null;
  localMap: string;
  match: HostedMatch | null;
  restartIn: number | null;
};

const page = SERVER as unknown as HostPage | null;

export const hostPage = (): HostPage => page as HostPage;

const state = {
  phase: PHASE.boot as Phase,
  since: Date.now(),
  slowSaid: false,
  awaySince: 0,
  restartAt: 0,
  spectateAt: 0,
  last: '',
  settings: null as Match | null,
  localMap: null as LocalMap | null,
  seen: new Map<unknown, { name: string }>(),
  kicked: new Map<unknown, number>(),
  guestSaid: false,
};

const cfg = (): ServerSettings => hostPage().server;
const account = (): Account => game.myAccount() || {};
const secondsOf = (milliseconds: number): number => Math.round(milliseconds / MILLISECONDS_PER_SECOND);

function enter(phase: Phase, why = ''): void {
  state.phase = phase;
  state.since = Date.now();
  state.slowSaid = false;
  state.awaySince = 0;
  if (why) state.last = why;
}

function slowNote(what: string): void {
  if (state.slowSaid || Date.now() - state.since < SLOW_MS) return;
  state.slowSaid = true;
  print(TEXT.slow(what, secondsOf(Date.now() - state.since)), COLOR.warn);
}

function fail(why: string): void {
  print(TEXT.line(why), COLOR.error);
  state.seen.clear();
  if (cfg().restart_after_s > 0) {
    enter(PHASE.waiting, why);
    state.restartAt = Date.now() + cfg().restart_after_s * MILLISECONDS_PER_SECOND;
    print(TEXT.startingAgain(cfg().restart_after_s), COLOR.hint);
  } else {
    enter(PHASE.stopped, why);
    print(TEXT.stopped, COLOR.hint);
  }
}

const guarded = <Args extends unknown[]>(what: string, run: (...args: Args) => void) => (...args: Args): void => {
  try {
    run(...args);
  } catch (error) {
    print(TEXT.guarded(what, error ? (error as { message?: unknown }).message : error), COLOR.error);
  }
};

const ignoringErrors = (run: () => void): void => {
  try {
    run();
  } catch {
    return;
  }
};

const timeZoneRegion = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone.split(TIME_ZONE_SEPARATOR).shift() ?? '';
  } catch {
    return '';
  }
};

function matchSettings(): Match {
  const settings: Match = { ...hostPage().match };
  const me = account();
  if (!settings.title) settings.title = TEXT.defaultTitle(me.nickname || stringOf(me.login || '') || TEXT.defaultTitleName);
  if (!settings.p2p_region) settings.p2p_region = timeZoneRegion();
  return settings;
}

function create(): void {
  const settings = matchSettings();
  const me = account();
  if (me.is_guest && !state.guestSaid) {
    state.guestSaid = true;
    print(TEXT.guest, COLOR.warn);
  }
  state.settings = settings;
  game.setCreateSettings(settings, false);
  enter(PHASE.creating);
  print(TEXT.creating(settings.title, settings.map_id, settings.game_type, settings.max_players, settings.p2p_region), COLOR.title);
  game.sendLobby(NET.CREATE_MATCH, [JSON.stringify(settings), game.replyTo()], guarded(TEXT.createReply, (reply: Reply) => {
    if (state.phase !== PHASE.creating) return;
    if (reply[0] === REPLY_OK) {
      game.enterMatch(reply[1], reply[2]);
      game.setJoinPassword(settings.password);
      enter(PHASE.joining);
    } else {
      fail(TEXT.notCreated(stripHtml(stringOf(reply[1]))));
    }
  }));
}

function start(): void {
  state.seen.clear();
  const label = game.frameLabel();
  if (game.lobbyReady() && label === SCREEN.lobby) {
    create();
    return;
  }
  enter(PHASE.boot);
}

function spectate(): void {
  const details = game.matchDetails();
  if (!details) return;
  const password = state.settings ? state.settings.password : '';
  game.sendLobby(NET.JOIN_MATCH, [details.uid, game.replyTo(), game.spectatorSlot(), '', password], guarded(TEXT.spectateReply, (reply: Reply) => {
    if (reply[0] === REPLY_OK) game.enterMatch(reply[1], reply[2]);
    else print(TEXT.spectateFailed(stripHtml(stringOf(reply[1]))), COLOR.warn);
  }));
}

export function roster(): RosterRow[] {
  const match = game.hostedMatch();
  if (!match) return [];
  const me = stringOf(account().login || '').toLowerCase();
  const rows: RosterRow[] = [];
  game.matchSlots(match).forEach((connection, slot) => {
    if (!connection) return;
    const info = game.slotInfo(connection);
    rows.push({ connection, slot, ...info, self: !!me && info.login.toLowerCase() === me });
  });
  return rows;
}

export const playerName = (row: RosterRow): string => (row.login && row.login !== row.nickname
  ? TEXT.playerName(row.nickname, row.login)
  : row.nickname || row.login || TEXT.slotName(row.slot));

function noteArrivals(rows: readonly RosterRow[]): void {
  const present = new Set<unknown>();
  for (const row of rows) {
    present.add(row.connection);
    if (state.seen.has(row.connection) || row.self) continue;
    state.seen.set(row.connection, { name: playerName(row) });
    print(TEXT.joined(playerName(row), row.slot, row.spectator, row.guest, row.reputation), COLOR.ok);
  }
  for (const [connection, { name }] of state.seen) {
    if (!present.has(connection)) {
      state.seen.delete(connection);
      print(TEXT.left(name), COLOR.hint);
    }
  }
}

export function tell(row: RosterRow, text: string): void {
  game.tellSlot(row.connection, TEXT.serverMessage(text));
}

export function kick(row: RosterRow, why = ''): void {
  if (row.self) throw new Error(TEXT.selfKick);
  if (row.authId === null || row.authId === undefined) throw new Error(TEXT.noAuthId(playerName(row)));
  if (why) ignoringErrors(() => tell(row, why));
  game.sendLobby(NET.KICK_USER, [stringOf(row.authId), game.replyTo(), KICK_KEEP_OUT], guarded(TEXT.kickReply, (reply: Reply) => {
    const result = stringOf(reply[0]);
    print(TEXT.kickResult(playerName(row), stripHtml(result)), result.includes(KICK_DONE) ? COLOR.ok : COLOR.warn);
  }));
}

function enforceAllow(rows: readonly RosterRow[]): void {
  const allow = cfg().allow;
  if (!allow.length) return;
  const now = Date.now();
  for (const row of rows) {
    if (row.self || allow.includes(row.login.toLowerCase()) || row.authId === null) continue;
    if (now - (state.kicked.get(row.authId) || 0) < KICK_AGAIN_MS) continue;
    state.kicked.set(row.authId, now);
    print(TEXT.notAllowed(playerName(row)), COLOR.warn);
    try {
      kick(row, TEXT.invitedOnly);
    } catch (error) {
      print(TEXT.line((error as Error).message), COLOR.error);
    }
  }
}

async function loadLocalMap(name: string): Promise<LocalMap> {
  const body = new URLSearchParams({ rq: MAP_REQUEST_KIND, cmap: LOCAL_MAP_ID_PREFIX + name });
  const response = await fetch(MAP_URL, { method: HTTP_METHOD.post, body, cache: NO_STORE_CACHE });
  const text = (await response.text()).replace(BYTE_ORDER_MARK, '').trim();
  if (!response.ok || !text.startsWith(MAP_START) || text.startsWith(MAP_MARKER.notPublished)) throw new Error(TEXT.noLocalMap(name));
  return { name, text, players: (text.match(PLAYER_START) || []).length };
}

function applyLocalMap(match: HostedMatch, localMap: LocalMap): void {
  game.setMatchMap(match, [localMap.text, localMap.name, MAP_NOT_COMPRESSED, stringOf(match.players_max), LOCAL_MAP_ID_PREFIX + localMap.name]);
  print(TEXT.mapSent(localMap.name), COLOR.ok);
  if (localMap.players && localMap.players < (match.players_max as number)) {
    print(TEXT.fewStarts(localMap.name, localMap.players, match.players_max), COLOR.hint);
  }
}

export async function useLocalMap(name: string): Promise<void> {
  const localMap = await loadLocalMap(name);
  state.localMap = localMap;
  print(TEXT.localMapLoaded(name, localMap.text.length), COLOR.ok);
  const match = game.hostedMatch();
  if (state.phase === PHASE.running && match) applyLocalMap(match, localMap);
  else print(TEXT.sentOnceRunning, COLOR.hint);
}

export function dropLocalMap(): LocalMap | null {
  const had = state.localMap;
  state.localMap = null;
  return had;
}

export function ownerCommand(text: string): void {
  if (state.phase !== PHASE.running) throw new Error(TEXT.notRunning(state.phase));
  game.sendChat(text);
}

export function say(text: string): void {
  if (state.phase !== PHASE.running) throw new Error(TEXT.notRunning(state.phase));
  game.sendChat(text);
}

export function stop(): boolean {
  const wasRunning = state.phase === PHASE.running;
  if (wasRunning) ignoringErrors(() => game.sendChat(OWNER_COMMAND.terminate));
  enter(PHASE.stopped, TEXT.stoppedFromTerminal);
  state.seen.clear();
  return wasRunning;
}

export function startAgain(): void {
  if (state.phase !== PHASE.stopped && state.phase !== PHASE.waiting) throw new Error(TEXT.already(state.phase));
  start();
}

export function restart(): void {
  stop();
  enter(PHASE.waiting, TEXT.restartFromTerminal);
  state.restartAt = Date.now() + RESTART_PAUSE_MS;
}

export function hostStatus(): HostStatus {
  return {
    phase: state.phase,
    seconds: secondsOf(Date.now() - state.since),
    last: state.last,
    settings: state.settings,
    localMap: state.localMap ? state.localMap.name : '',
    match: game.hostedMatch(),
    restartIn: state.phase === PHASE.waiting ? Math.max(0, secondsOf(state.restartAt - Date.now())) : null,
  };
}

function running(): void {
  const match = game.hostedMatch();
  const label = game.frameLabel();
  const isAway = label === SCREEN.lobby || label === SCREEN.menu;
  if (!match) {
    fail(TEXT.matchGone);
    return;
  }
  if (isAway) {
    if (!state.awaySince) state.awaySince = Date.now();
    else if (Date.now() - state.awaySince > AWAY_MS) {
      fail(TEXT.leftMatch(label));
      return;
    }
  } else {
    state.awaySince = 0;
  }
  const now = Date.now();
  if (!cfg().host_plays && game.inLevelFrame() && !game.isSpectating() && now > state.spectateAt) {
    state.spectateAt = now + SPECTATE_RETRY_MS;
    spectate();
  }
  if (state.localMap && game.matchMapText(match) !== state.localMap.text) applyLocalMap(match, state.localMap);
  const rows = roster();
  noteArrivals(rows);
  enforceAllow(rows);
}

function bootTick(): void {
  const label = game.frameLabel();
  if (label === SCREEN.menu) {
    game.goToScreen(SCREEN.lobby);
    enter(PHASE.lobby);
  } else if (label === SCREEN.lobby) {
    enter(PHASE.lobby);
  } else {
    slowNote(TEXT.waitingMenu(label));
  }
}

function joiningTick(): void {
  if (!game.hostedMatch() || !game.inLevelFrame()) {
    slowNote(TEXT.waitingJoin);
    return;
  }
  enter(PHASE.running);
  const settings = state.settings;
  if (settings) print(TEXT.running(settings.title, !!settings.password, settings.p2p_region), COLOR.ok);
}

function tick(): void {
  switch (state.phase) {
    case PHASE.boot:
      bootTick();
      break;
    case PHASE.lobby:
      if (game.lobbyReady()) create();
      else slowNote(TEXT.waitingLogin);
      break;
    case PHASE.creating:
      slowNote(TEXT.waitingCreate);
      break;
    case PHASE.joining:
      joiningTick();
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

let ticking: ReturnType<typeof setInterval> | null = null;

export function startHost(): void {
  if (ticking || !page) return;
  game.setChatTrace(true);
  if (cfg().ice_servers.length) game.addIceServers(cfg().ice_servers);
  if (cfg().local_map) useLocalMap(cfg().local_map).catch((error: unknown) => print(TEXT.localMapFailed((error as Error).message), COLOR.error));
  print(TEXT.welcome, COLOR.bright);
  ticking = setInterval(guarded(TEXT.tick, tick), TICK_MS);
}

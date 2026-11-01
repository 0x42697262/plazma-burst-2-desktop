import { textOf } from '#kernel/text/text-of.ts';
import { FORCED_MATCH_VALUES, FPS_RANGE, MAX_PLAYERS, MAX_REGION_LENGTH, MAX_TITLE_LENGTH, MIN_REPUTATION, PORT_RANGE, VPN_GUESTS } from '../constants.ts';
import {
  CONFIG_FLAG, CONFIG_FLAG_WITH_VALUE, DECIMAL_COMMA, DECIMAL_POINT, DEFAULT_DURATION_WORDS, DURATION_PART, DURATION_UNIT_MS, GAME_TYPES, ICE_URL_PATTERN,
  LOCAL_MAP_NAME, LOCAL_MAP_PREFIX, LOGIN_PATTERN, MAP_FILE_EXTENSION, MATCH_DEFAULTS, MATCH_KEY, PING_ACTIONS, PORT_RANGE_PATTERN, PRIVATE_KEY_PREFIX,
  RESPAWN_MODELS, SERVER_DEFAULTS, type MatchFields, SERVER_SPLIT_MARKER, SINGLE_PORT_PATTERN, SPLIT_MARKER_FIELDS, TEXT_MATCH_FIELDS, TURN_PREFIX,
} from '../keys.ts';
import { CONFIG_TEXT, FORCED_WHY } from '../text.ts';

export type Match = MatchFields;
export type PortRange = { min: number; max: number };
export type IceServer = { urls: string | string[]; username?: string; credential?: string };
export type ServerSettings = {
  allow: string[];
  host_plays: boolean;
  local_map: string;
  region: string;
  udp_ports: PortRange | null;
  ice_servers: IceServer[];
  fps: number;
  restart_after_s: number;
};
export type CheckedConfig = { match: Match | null; server: ServerSettings | null; problems: string[]; errors: string[] };

type Raw = Record<string, unknown>;

const isPlainObject = (value: unknown): value is Raw => typeof value === 'object' && value !== null && !Array.isArray(value);
const hasKey = <Shape extends object>(shape: Shape, key: string): key is Extract<keyof Shape, string> => Object.hasOwn(shape, key);

export function roundDurationMs(text: unknown): number | null {
  const lowered = textOf(text ?? '').trim().toLowerCase();
  if (DEFAULT_DURATION_WORDS.has(lowered)) return 0;
  let total = 0;
  let rest = lowered.replace(DECIMAL_COMMA, DECIMAL_POINT);
  for (let part = DURATION_PART.exec(rest); part; part = DURATION_PART.exec(rest)) {
    total += Number(part[1]) * (DURATION_UNIT_MS[part[2] ?? ''] ?? 0);
    rest = rest.slice(part[0].length);
  }
  const isUnreadable = rest.trim() !== '' || total <= 0;
  return isUnreadable ? null : Math.round(total);
}

export function parsePorts(value: unknown): PortRange | null {
  if (value === '' || value === null || value === undefined) return null;
  const text = textOf(value).trim();
  const range = PORT_RANGE_PATTERN.exec(text) ?? SINGLE_PORT_PATTERN.exec(text);
  if (!range) throw new Error(CONFIG_TEXT.portsNotRange(textOf(value)));
  const min = Number(range[1]);
  const max = range[2] ? Number(range[2]) : min;
  const isOutOfRange = min < PORT_RANGE.min || max > PORT_RANGE.max || min > max;
  if (isOutOfRange) throw new Error(CONFIG_TEXT.portsOutOfRange(textOf(value), PORT_RANGE.min, PORT_RANGE.max));
  return { min, max };
}

export function parseIceServers(value: unknown): IceServer[] {
  if (!Array.isArray(value)) throw new Error(CONFIG_TEXT.iceNotList);
  return value.map((server: unknown, index) => {
    const entry: Raw | null = typeof server === 'string' ? { urls: server } : isPlainObject(server) ? server : null;
    const urls: unknown[] = entry ? ([] as unknown[]).concat(entry.urls ?? []) : [];
    const hasValidUrls = urls.length > 0 && urls.every((url) => typeof url === 'string' && ICE_URL_PATTERN.test(url));
    if (!entry || !hasValidUrls) throw new Error(CONFIG_TEXT.iceNeedsUrls(index));
    const textUrls = urls as string[];
    const isTurn = textUrls.some((url) => url.startsWith(TURN_PREFIX));
    if (isTurn && (typeof entry.username !== 'string' || typeof entry.credential !== 'string')) throw new Error(CONFIG_TEXT.iceNeedsCredentials(index));
    const checked: IceServer = { urls: textUrls.length === 1 ? textUrls[0] ?? '' : textUrls };
    if (entry.username !== undefined) checked.username = textOf(entry.username);
    if (entry.credential !== undefined) checked.credential = textOf(entry.credential);
    return checked;
  });
}

function copyMatch(raw: Raw, match: Match, problems: string[]): void {
  for (const [key, value] of Object.entries(raw)) {
    if (!hasKey(MATCH_DEFAULTS, key)) {
      problems.push(CONFIG_TEXT.matchUnknown(key));
      continue;
    }
    if (hasKey(FORCED_MATCH_VALUES, key)) {
      const forced = FORCED_MATCH_VALUES[key];
      if (value !== forced) problems.push(CONFIG_TEXT.matchForced(key, forced, FORCED_WHY[key] ?? ''));
      continue;
    }
    Reflect.set(match, key, value);
  }
}

function checkTextFields(match: Match, errors: string[]): void {
  for (const key of TEXT_MATCH_FIELDS) {
    const value: unknown = match[key];
    if (typeof value === 'string') continue;
    if (typeof value === 'number') match[key] = String(value);
    else errors.push(CONFIG_TEXT.matchNotText(key));
  }
}

function checkChoices(match: Match, errors: string[]): void {
  match.game_type = textOf(match.game_type).toUpperCase();
  if (!GAME_TYPES.includes(match.game_type)) errors.push(CONFIG_TEXT.oneOf('game_type', GAME_TYPES));
  match.max_players = Number(match.max_players);
  if (!MAX_PLAYERS.includes(match.max_players)) errors.push(CONFIG_TEXT.oneOf('max_players', MAX_PLAYERS));
  match.min_reputation = Number(match.min_reputation);
  if (!MIN_REPUTATION.includes(match.min_reputation)) errors.push(CONFIG_TEXT.oneOf('min_reputation', MIN_REPUTATION));
  if (!PING_ACTIONS.includes(match.ping_limit_action)) errors.push(CONFIG_TEXT.oneOf('ping_limit_action', PING_ACTIONS));
  if (!RESPAWN_MODELS.includes(match.respawn_model)) errors.push(CONFIG_TEXT.oneOf('respawn_model', RESPAWN_MODELS));
}

function checkNumbers(match: Match, errors: string[]): void {
  if (typeof match.exclude_inactive_players !== 'boolean') errors.push(CONFIG_TEXT.excludeInactive);
  const pingLimit: unknown = match.ping_limit;
  const hasPingLimit = pingLimit !== '';
  const isValidPingLimit = !hasPingLimit || (Number.isInteger(Number(pingLimit)) && Number(pingLimit) >= 0);
  if (!isValidPingLimit) errors.push(CONFIG_TEXT.pingLimit);
  match.ping_limit = hasPingLimit ? String(Number(pingLimit)) : '';
  const rounds = Number(match.rounds_until_rotation);
  if (!Number.isInteger(rounds) || rounds < 1) errors.push(CONFIG_TEXT.rounds);
  else match.rounds_until_rotation = String(rounds);
  const durationMs = roundDurationMs(match.round_duration_str);
  if (durationMs === null) errors.push(CONFIG_TEXT.roundDuration);
  else match.round_duration = durationMs;
  match.allow_vpn_guests = match.allow_vpn_guests ? VPN_GUESTS.allowed : VPN_GUESTS.refused;
  const region: unknown = match.p2p_region;
  if (typeof region !== 'string' || region.length > MAX_REGION_LENGTH) errors.push(CONFIG_TEXT.matchRegion(MAX_REGION_LENGTH));
}

export function checkMatch(raw: unknown): { match: Match; problems: string[]; errors: string[] } {
  const problems: string[] = [];
  const errors: string[] = [];
  const match: Match = { ...MATCH_DEFAULTS };
  const given = raw === undefined ? {} : raw;
  if (!isPlainObject(given)) return { match, problems, errors: [CONFIG_TEXT.matchNotObject] };
  copyMatch(given, match, problems);
  checkTextFields(match, errors);
  if (errors.length) return { match, problems, errors };

  if (!match.map_id.trim()) errors.push(CONFIG_TEXT.mapIdMissing);
  if (match.title.length > MAX_TITLE_LENGTH) errors.push(CONFIG_TEXT.titleTooLong(MAX_TITLE_LENGTH));
  for (const key of SPLIT_MARKER_FIELDS) if (match[key].includes(SERVER_SPLIT_MARKER)) errors.push(CONFIG_TEXT.splitMarker(key));
  checkChoices(match, errors);
  checkNumbers(match, errors);
  return { match, problems, errors };
}

function checkServer(raw: Raw, match: Match, problems: string[], errors: string[]): ServerSettings {
  const given: Raw = { ...SERVER_DEFAULTS };
  for (const [key, value] of Object.entries(raw)) {
    if (key === MATCH_KEY || key.startsWith(PRIVATE_KEY_PREFIX)) continue;
    if (!hasKey(SERVER_DEFAULTS, key)) {
      problems.push(CONFIG_TEXT.unknownSetting(key));
      continue;
    }
    given[key] = value;
  }
  const allow = given.allow;
  const isLoginList = Array.isArray(allow) && allow.every((login) => typeof login === 'string' && LOGIN_PATTERN.test(login.trim()));
  if (!isLoginList) errors.push(CONFIG_TEXT.allow);
  const allowed = isLoginList ? [...new Set((allow as string[]).map((login) => login.trim().toLowerCase()))] : [];

  const hostPlays = given.host_plays;
  if (typeof hostPlays !== 'boolean') errors.push(CONFIG_TEXT.hostPlays);

  const localMap = given.local_map;
  const isLocalMapName = typeof localMap === 'string' && (!localMap || LOCAL_MAP_NAME.test(localMap));
  if (!isLocalMapName) errors.push(CONFIG_TEXT.localMap);
  const mapName = isLocalMapName ? localMap.replace(LOCAL_MAP_PREFIX, '').replace(MAP_FILE_EXTENSION, '') : '';

  const region = given.region;
  const isRegion = typeof region === 'string' && region.length <= MAX_REGION_LENGTH;
  if (!isRegion) errors.push(CONFIG_TEXT.region(MAX_REGION_LENGTH));
  else if (region) match.p2p_region = region;

  let udpPorts: PortRange | null = null;
  try {
    udpPorts = parsePorts(given.udp_ports);
  } catch (error) {
    errors.push((error as Error).message);
  }
  let iceServers: IceServer[] = [];
  try {
    iceServers = parseIceServers(given.ice_servers);
  } catch (error) {
    errors.push((error as Error).message);
  }
  const fps = Number(given.fps);
  if (!Number.isInteger(fps) || fps < FPS_RANGE.min || fps > FPS_RANGE.max) errors.push(CONFIG_TEXT.fps(FPS_RANGE.min, FPS_RANGE.max));
  const restartAfterS = Number(given.restart_after_s);
  if (!Number.isFinite(restartAfterS) || restartAfterS < 0) errors.push(CONFIG_TEXT.restartAfter);

  return {
    allow: allowed,
    host_plays: hostPlays === true,
    local_map: mapName,
    region: isRegion ? region : '',
    udp_ports: udpPorts,
    ice_servers: iceServers,
    fps,
    restart_after_s: restartAfterS,
  };
}

export function checkConfig(raw: unknown): CheckedConfig {
  if (!isPlainObject(raw)) return { match: null, server: null, problems: [], errors: [CONFIG_TEXT.notObject] };
  const { match, problems, errors } = checkMatch(raw[MATCH_KEY]);
  const server = checkServer(raw, match, problems, errors);
  if (server.local_map && match.map_rotation) problems.push(CONFIG_TEXT.rotationWithLocalMap(match.map_rotation));
  const isOpenToAnyone = !errors.includes(CONFIG_TEXT.allow) && !server.allow.length && !match.password;
  if (isOpenToAnyone) problems.push(CONFIG_TEXT.openToAnyone);
  return { match, server, problems, errors };
}

export function parseServerArgs(args: readonly string[]): { config: string | null; problems: string[] } {
  const problems: string[] = [];
  let config: string | null = null;
  for (let index = 0; index < args.length; index++) {
    const arg = args[index] ?? '';
    if (arg === CONFIG_FLAG) {
      config = args[index + 1] || null;
      if (!config) problems.push(CONFIG_TEXT.configNeedsFile);
      index++;
    } else if (arg.startsWith(CONFIG_FLAG_WITH_VALUE)) {
      config = arg.slice(CONFIG_FLAG_WITH_VALUE.length) || null;
    }
  }
  return { config, problems };
}

import fs from 'node:fs';
import { CHEAT_ACTIONS, BYTE_ORDER_MARK, MAP_ID_SEPARATOR, MISSING_FILE, NAME_LISTS, NICKNAME, PRIVATE_KEY_PREFIX, TEXT_ENCODING } from './keys.ts';
import { MAX_DESCRIPTION_LENGTH, MAX_NAME_LENGTH, PORT_RANGE, SERVER_DEFAULTS } from './constants.ts';
import { CONFIG_TEXT as TEXT } from './text.ts';

export type ServerConfig = {
  name: string; description: string; port: number; bind: string; password: string; nicknames: string[]; admins: string[];
  max_players: number; skin: number; download_maps: boolean; random_maps: string[]; cheat_reports: string; welcome: string;
};
export type CheckedServerConfig = { server: ServerConfig | null; problems: string[]; errors: string[] };
type Raw = Record<string, unknown>;

const isPlainObject = (value: unknown): value is Raw => !!value && typeof value === 'object' && !Array.isArray(value);
const isNameList = (value: unknown): value is string[] => Array.isArray(value) && value.every((name) => typeof name === 'string' && NICKNAME.test(name.trim()));
const isMapList = (value: unknown): value is string[] => Array.isArray(value) && value.every((id) => typeof id === 'string' && !!id.trim() && !id.includes(MAP_ID_SEPARATOR));
const uniqueLowered = (names: readonly string[]): string[] => [...new Set(names.map((name) => name.trim().toLowerCase()))];

export function checkConfig(raw: unknown): CheckedServerConfig {
  const problems: string[] = [];
  const errors: string[] = [];
  if (!isPlainObject(raw)) return { server: null, problems, errors: [TEXT.notObject] };
  const given: Raw = { ...SERVER_DEFAULTS };
  for (const [key, value] of Object.entries(raw)) {
    if (key.startsWith(PRIVATE_KEY_PREFIX)) continue;
    if (!Object.hasOwn(SERVER_DEFAULTS, key)) {
      problems.push(TEXT.unknownSetting(key));
      continue;
    }
    given[key] = value;
  }
  const port = Number(given.port);
  if (!Number.isInteger(port) || port < PORT_RANGE.min || port > PORT_RANGE.max) errors.push(TEXT.port);
  if (typeof given.bind !== 'string' || !given.bind) errors.push(TEXT.bind);
  if (typeof given.password !== 'string') errors.push(TEXT.password);
  const lists: Record<string, string[]> = {};
  for (const key of NAME_LISTS) {
    const names = given[key];
    if (isNameList(names)) lists[key] = uniqueLowered(names);
    else errors.push(TEXT.nameList(key));
  }
  const maxPlayers = Number(given.max_players);
  if (!Number.isInteger(maxPlayers) || maxPlayers < 1) errors.push(TEXT.maxPlayers);
  const skin = Number(given.skin);
  if (!Number.isInteger(skin) || skin < 0) errors.push(TEXT.skin);
  if (typeof given.download_maps !== 'boolean') errors.push(TEXT.downloadMaps);
  const randomMaps = given.random_maps;
  if (!isMapList(randomMaps)) errors.push(TEXT.randomMaps);
  if (!CHEAT_ACTIONS.includes(given.cheat_reports as typeof CHEAT_ACTIONS[number])) errors.push(TEXT.cheatReports(CHEAT_ACTIONS));
  if (typeof given.welcome !== 'string') errors.push(TEXT.welcome);
  const name = given.name;
  if (typeof name !== 'string' || !name.trim() || name.length > MAX_NAME_LENGTH) errors.push(TEXT.name);
  const description = given.description;
  if (typeof description !== 'string' || description.length > MAX_DESCRIPTION_LENGTH) errors.push(TEXT.description);
  const server: ServerConfig = {
    ...(given as unknown as ServerConfig),
    port,
    max_players: maxPlayers,
    skin,
    nicknames: lists.nicknames ?? [],
    admins: lists.admins ?? [],
    random_maps: isMapList(randomMaps) ? [...new Set(randomMaps.map((id) => id.trim()))] : [],
  };
  if (!errors.length && !server.password && !server.nicknames.length) problems.push(TEXT.openToAnyone);
  return { server, problems, errors };
}

export function loadConfig(file: string): CheckedServerConfig & { missing: boolean } {
  let text: string;
  try {
    text = fs.readFileSync(file, TEXT_ENCODING);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === MISSING_FILE) return { ...checkConfig({}), missing: true };
    return { server: null, problems: [], errors: [TEXT.unreadable(file, (error as Error).message)], missing: false };
  }
  try {
    return { ...checkConfig(JSON.parse(text.replace(BYTE_ORDER_MARK, ''))), missing: false };
  } catch (error) {
    return { server: null, problems: [], errors: [TEXT.notJson(file, (error as Error).message)], missing: false };
  }
}

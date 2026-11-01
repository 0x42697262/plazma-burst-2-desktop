import { ROUTE } from '#shared/contract/routes.ts';
import { stringOf } from '#kernel/text/text-of.ts';
import { FEATURE } from '#shared/features/keys.ts';
import { isFeatureOn } from '../../flags.ts';
import { HISTORY_MAX, SAVE_DELAY_MS } from './constants.ts';
import {
  CHAIN_JOIN, EMPTY_FILE, FILE_SECTION, FILE_SECTIONS, LOAD_SOURCE, NO_STORE, PROFILE_NAME, PROFILE_SECTION, PROFILE_SECTIONS, PUT_METHOD, SOURCE,
  SPACE_CHARACTER, SPACE_KEY, STORAGE_KEY, TELEPORT_COMMAND, TRAILING_BIND_WORD, type LoadSource,
} from './keys.ts';
import { TEXT } from './text.ts';
import { SCHEMA, affectsGame, parseValue } from './schema.ts';
import { parseKeyName } from './key-names.ts';

export { HISTORY_MAX, PROFILE_NAME };

type Value = boolean | number | string;
type Values = Record<string, Value>;
type Binds = Record<string, string>;
export type Profile = { values: Values; binds: Binds; onload: string };
export type ActiveProfile = Profile & { name: string };
export type ActiveBind = { command: string; profile: string | null } | null;
type Raw = Record<string, unknown>;

let values: Values = {};
let bindMap: Binds = {};
let profileMap: Record<string, Profile> = {};
let mapProfiles: Record<string, string> = {};
let problems: string[] = [];
let mapNow: () => unknown = () => null;
const lines: string[] = [];
let saveTimer: ReturnType<typeof setTimeout> | undefined;

export const setMapSource = (source: () => unknown): void => { mapNow = source; };

export function currentMap(): string | null {
  try {
    const id = mapNow();
    return id ? stringOf(id) : null;
  } catch {
    return null;
  }
}

export function activeProfile(): ActiveProfile | null {
  if (!isFeatureOn(FEATURE.profiles)) return null;
  const id = currentMap();
  const name = id ? mapProfiles[id] : undefined;
  const profile = name ? profileMap[name] : undefined;
  return name && profile ? { name, ...profile } : null;
}

const emptyProfile = (): Profile => ({ values: {}, binds: {}, onload: '' });

const profileJson = (profile: Profile): Raw => ({
  ...profile.values,
  ...(Object.keys(profile.binds).length ? { [PROFILE_SECTION.binds]: profile.binds } : {}),
  ...(profile.onload ? { [PROFILE_SECTION.onload]: profile.onload } : {}),
});

const fromProfile = (key: string): ActiveProfile | null => {
  const profile = activeProfile();
  return profile && Object.hasOwn(profile.values, key) ? profile : null;
};

const defaultOf = (key: string): Value | undefined => (Object.hasOwn(SCHEMA, key) ? (SCHEMA as Record<string, { default?: Value }>)[key]?.default : undefined);

export const settings = {
  has: (key: string): boolean => !!fromProfile(key) || Object.hasOwn(values, key),
  get: (key: string): Value | undefined => fromProfile(key)?.values[key] ?? values[key],
  effective: (key: string): Value | undefined => (settings.has(key) ? settings.get(key) : defaultOf(key)),
  source: (key: string): string => fromProfile(key)?.name ?? (Object.hasOwn(values, key) ? SOURCE.yours : SOURCE.default),
  hasOwn: (key: string): boolean => Object.hasOwn(values, key),
  own: (key: string): Value | undefined => values[key],
  set(key: string, value: Value): void {
    values[key] = value;
    save();
  },
  unset(key: string): void {
    delete values[key];
    save();
  },
  clear(): void {
    values = {};
    save();
  },
  snapshot: (): Values => ({ ...values }),
};

function profileFor(name: string): Profile {
  profiles.create(name);
  const profile = profileMap[name];
  if (!profile) throw new Error(TEXT.notProfileName(name));
  return profile;
}

export const profiles = {
  names: (): string[] => Object.keys(profileMap).sort(),
  exists: (name: string): boolean => Object.hasOwn(profileMap, name),
  get: (name: string): Profile | undefined => profileMap[name],
  create(name: string): void {
    if (!PROFILE_NAME.test(name)) throw new Error(TEXT.notProfileName(name));
    if (!profileMap[name]) {
      profileMap[name] = emptyProfile();
      save();
    }
  },
  set(name: string, key: string, value: Value): void {
    profileFor(name).values[key] = value;
    save();
  },
  unset(name: string, key: string): void {
    const profile = profileMap[name];
    if (!profile) return;
    delete profile.values[key];
    save();
  },
  bind(name: string, key: string, command: string): void {
    profileFor(name).binds[key] = command;
    save();
  },
  unbind(name: string, key: string): void {
    const profile = profileMap[name];
    if (!profile) return;
    delete profile.binds[key];
    save();
  },
  setOnload(name: string, commands: string): void {
    profileFor(name).onload = commands;
    save();
  },
  remove(name: string): string[] {
    const maps = profiles.mapsUsing(name);
    delete profileMap[name];
    for (const id of maps) delete mapProfiles[id];
    save();
    return maps;
  },
  of: (mapId: string): string | null => mapProfiles[mapId] ?? null,
  use(mapId: string, name: string | null): void {
    if (name === null) {
      delete mapProfiles[mapId];
    } else {
      profiles.create(name);
      mapProfiles[mapId] = name;
    }
    save();
  },
  mapsUsing: (name: string): string[] => Object.keys(mapProfiles).filter((id) => mapProfiles[id] === name).sort(),
  maps: (): Record<string, string> => ({ ...mapProfiles }),
};

export const loadProblems = (): string[] => problems.slice();

export const binds = {
  get: (key: string): string | undefined => bindMap[key],
  active(key: string): ActiveBind {
    const profile = activeProfile();
    const profileCommand = profile?.binds[key];
    if (profile && profileCommand) return { command: profileCommand, profile: profile.name };
    const command = bindMap[key];
    return command ? { command, profile: null } : null;
  },
  set(key: string, command: string): void {
    bindMap[key] = command;
    save();
  },
  remove(key: string): void {
    delete bindMap[key];
    save();
  },
  clear(): number {
    const count = Object.keys(bindMap).length;
    bindMap = {};
    save();
    return count;
  },
  keys: (): string[] => Object.keys(bindMap).sort(),
  boundTo: (command: string): string[] => Object.keys(bindMap).filter((key) => bindMap[key]?.toLowerCase() === command),
};

export const history = {
  lines,
  add(line: string): void {
    if (!line.trim() || lines[lines.length - 1] === line) return;
    lines.push(line);
    if (lines.length > HISTORY_MAX) lines.splice(0, lines.length - HISTORY_MAX);
    save();
  },
};

const isObject = (value: unknown): value is Raw => !!value && typeof value === 'object' && !Array.isArray(value);
const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

function sanitizeValues(raw: unknown, where: string, onlyGameKeys: boolean): Values {
  const sanitized: Values = {};
  const skipped = where ? PROFILE_SECTIONS : FILE_SECTIONS;
  for (const [key, value] of Object.entries(isObject(raw) ? raw : {})) {
    if (skipped.includes(key)) continue;
    if (!Object.hasOwn(SCHEMA, key)) {
      problems.push(TEXT.unknownKey(where, key));
      continue;
    }
    if (onlyGameKeys && !affectsGame(key)) {
      problems.push(TEXT.consoleKeyInProfile(where, key));
      continue;
    }
    try {
      sanitized[key] = parseValue(key, value);
    } catch (error) {
      problems.push(TEXT.badValue(where, key, JSON.stringify(value), messageOf(error)));
    }
  }
  return sanitized;
}

function sanitizeBinds(raw: unknown, where = ''): Binds {
  const sanitized: Binds = {};
  if (raw === undefined) return sanitized;
  if (!isObject(raw)) {
    if (where) problems.push(TEXT.bindsNotObject(where.replace(TRAILING_BIND_WORD, '')));
    return sanitized;
  }
  for (const [key, command] of Object.entries(raw)) {
    try {
      if (typeof command !== 'string' || !command.trim()) throw new Error(TEXT.commandNotText);
      sanitized[parseKeyName(key)] = command.trim();
    } catch (error) {
      if (where) problems.push(TEXT.badBind(where, key, messageOf(error)));
    }
  }
  return sanitized;
}

function onloadOf(raw: unknown, where: string): string {
  const given = raw ?? '';
  const isCommandList = Array.isArray(given) && given.every((command) => typeof command === 'string');
  const onload = isCommandList ? given.join(CHAIN_JOIN) : given;
  if (typeof onload === 'string') return onload.trim();
  problems.push(TEXT.badOnload(where));
  return '';
}

function sanitizeProfiles(raw: unknown): Record<string, Profile> {
  const sanitized: Record<string, Profile> = {};
  if (raw === undefined) return sanitized;
  if (!isObject(raw)) {
    problems.push(TEXT.profilesNotObject);
    return sanitized;
  }
  for (const [name, profileValues] of Object.entries(raw)) {
    if (!PROFILE_NAME.test(name)) {
      problems.push(TEXT.badProfileName(name));
      continue;
    }
    if (!isObject(profileValues)) {
      problems.push(TEXT.profileNotObject(name));
      continue;
    }
    const where = TEXT.profileWhere(name);
    const onload = onloadOf(profileValues[PROFILE_SECTION.onload], where);
    sanitized[name] = {
      values: sanitizeValues(profileValues, where, true),
      binds: sanitizeBinds(profileValues[PROFILE_SECTION.binds], TEXT.profileBindWhere(where)),
      onload,
    };
  }
  return sanitized;
}

function sanitizeMapProfiles(raw: unknown, known: Record<string, Profile>): Record<string, string> {
  const sanitized: Record<string, string> = {};
  if (raw === undefined) return sanitized;
  if (!isObject(raw)) {
    problems.push(TEXT.mapsNotObject);
    return sanitized;
  }
  for (const [id, name] of Object.entries(raw)) {
    if (typeof name !== 'string' || !known[name]) {
      problems.push(TEXT.noSuchProfile(id, JSON.stringify(name)));
      continue;
    }
    sanitized[id] = name;
  }
  return sanitized;
}

function apply(raw: unknown): void {
  problems = [];
  const file = isObject(raw) ? raw : null;
  values = sanitizeValues(file, '', false);
  bindMap = sanitizeBinds(file?.[FILE_SECTION.binds]);
  profileMap = sanitizeProfiles(file?.[FILE_SECTION.profiles]);
  mapProfiles = sanitizeMapProfiles(file?.[FILE_SECTION.maps], profileMap);
  const savedHistory = file?.[FILE_SECTION.history];
  const typed = Array.isArray(savedHistory) ? savedHistory.filter((line): line is string => typeof line === 'string' && line.trim() !== '') : [];
  lines.length = 0;
  lines.push(...typed.slice(-HISTORY_MAX));
  const oldTeleportKey = file?.[FILE_SECTION.oldTeleportKey];
  if (typeof oldTeleportKey === 'string') {
    try {
      const key = parseKeyName(oldTeleportKey === SPACE_CHARACTER ? SPACE_KEY : oldTeleportKey);
      if (!bindMap[key]) bindMap[key] = TELEPORT_COMMAND;
      save();
    } catch {
      return;
    }
  }
}

function clearAll(): void {
  values = {};
  bindMap = {};
  profileMap = {};
  mapProfiles = {};
}

function writeLocal(data: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, data);
  } catch {
    return;
  }
}

async function loadFile(): Promise<boolean> {
  try {
    const response = await fetch(ROUTE.kv, { cache: NO_STORE });
    if (!response.ok) return false;
    apply(await response.json());
    return true;
  } catch {
    return false;
  }
}

export async function load(): Promise<LoadSource> {
  if (await loadFile()) return LOAD_SOURCE.file;
  try {
    apply(JSON.parse(localStorage.getItem(STORAGE_KEY) || EMPTY_FILE));
  } catch {
    clearAll();
  }
  return LOAD_SOURCE.localStorage;
}

export function reload(raw: unknown): void {
  clearTimeout(saveTimer);
  saveTimer = undefined;
  apply(raw);
  writeLocal(JSON.stringify(raw));
}

export function save(): void {
  const data = JSON.stringify({
    ...values,
    ...(Object.keys(bindMap).length ? { [FILE_SECTION.binds]: bindMap } : {}),
    ...(Object.keys(profileMap).length ? { [FILE_SECTION.profiles]: Object.fromEntries(Object.entries(profileMap).map(([name, profile]) => [name, profileJson(profile)])) } : {}),
    ...(Object.keys(mapProfiles).length ? { [FILE_SECTION.maps]: mapProfiles } : {}),
    ...(lines.length ? { [FILE_SECTION.history]: lines } : {}),
  });
  writeLocal(data);
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fetch(ROUTE.kv, { method: PUT_METHOD, body: data }).catch(() => undefined);
  }, SAVE_DELAY_MS);
}

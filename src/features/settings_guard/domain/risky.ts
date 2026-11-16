import { CHAIN_JOIN } from '#console/kernel/state/keys.ts';
import { CHAIN_SEPARATOR, LINE_BREAKS_AND_TABS, RISKY_COMMANDS, SECTION, SPACE, WORDS } from '../keys.ts';
import { SHOWN_COMMAND_MAX } from '../constants.ts';
import { TEXT } from '../text.ts';

export type RiskyCommand = Readonly<{ where: string; command: string }>;

type Settings = Readonly<Record<string, unknown>>;

const isObject = (value: unknown): value is Settings => !!value && typeof value === 'object' && !Array.isArray(value);

export const isRisky = (command: string): boolean => command.split(CHAIN_SEPARATOR)
  .some((part) => RISKY_COMMANDS.includes((part.trim().split(WORDS)[0] ?? '').toLowerCase()));

function onloadText(onload: unknown): string | null {
  const isCommandList = Array.isArray(onload) && onload.every((command) => typeof command === 'string');
  const joined: unknown = isCommandList ? onload.join(CHAIN_JOIN) : onload;
  return typeof joined === 'string' ? joined.trim() : null;
}

type Place = Readonly<{ where: string; path: readonly string[]; command: string }>;

function placesOf(settings: Settings): Place[] {
  const found: Place[] = [];
  const addBinds = (binds: unknown, path: readonly string[], where: (key: string) => string): void => {
    if (!isObject(binds)) return;
    for (const [key, command] of Object.entries(binds)) if (typeof command === 'string') found.push({ where: where(key), path: [...path, key], command: command.trim() });
  };
  addBinds(settings[SECTION.binds], [SECTION.binds], TEXT.bind);
  const profiles = settings[SECTION.profiles];
  if (!isObject(profiles)) return found;
  for (const [name, profile] of Object.entries(profiles)) {
    if (!isObject(profile)) continue;
    addBinds(profile[SECTION.binds], [SECTION.profiles, name, SECTION.binds], (key) => TEXT.profileBind(name, key));
    const onload = onloadText(profile[SECTION.onload]);
    if (onload !== null) found.push({ where: TEXT.profileOnload(name), path: [SECTION.profiles, name, SECTION.onload], command: onload });
  }
  return found;
}

function newRiskyPlaces(previous: unknown, next: unknown): Place[] {
  const before = new Map((isObject(previous) ? placesOf(previous) : []).map((place) => [place.where, place.command]));
  return (isObject(next) ? placesOf(next) : []).filter((place) => isRisky(place.command) && before.get(place.where) !== place.command);
}

export const newRiskyCommands = (previous: unknown, next: unknown): RiskyCommand[] => newRiskyPlaces(previous, next).map(({ where, command }) => ({ where, command }));

const valueAt = (settings: unknown, path: readonly string[]): unknown => path.reduce<unknown>((value, key) => (isObject(value) ? value[key] : undefined), settings);

function putBack(copy: Record<string, unknown>, path: readonly string[], previousValue: unknown): void {
  const parentPath = path.slice(0, -1);
  const key = path.at(-1) ?? '';
  const parent = valueAt(copy, parentPath);
  if (!isObject(parent)) return;
  const writable = parent as Record<string, unknown>;
  if (previousValue === undefined) Reflect.deleteProperty(writable, key);
  else writable[key] = previousValue;
}

export function withoutNewRisky(previous: unknown, next: unknown): Record<string, unknown> {
  const copy = JSON.parse(JSON.stringify(next ?? {})) as Record<string, unknown>;
  for (const place of newRiskyPlaces(previous, next)) putBack(copy, place.path, valueAt(previous, place.path));
  return copy;
}

export const shownCommand = (command: string): string => command.replace(LINE_BREAKS_AND_TABS, SPACE).trim().slice(0, SHOWN_COMMAND_MAX);

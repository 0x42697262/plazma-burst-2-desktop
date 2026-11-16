import { CHAIN_JOIN } from '#console/kernel/state/keys.ts';
import { CHAIN_SEPARATOR, RISKY_COMMANDS, SECTION, WORDS } from '../keys.ts';
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

function commandsOf(settings: Settings): Map<string, string> {
  const found = new Map<string, string>();
  const addBinds = (binds: unknown, place: (key: string) => string): void => {
    if (!isObject(binds)) return;
    for (const [key, command] of Object.entries(binds)) if (typeof command === 'string') found.set(place(key), command.trim());
  };
  addBinds(settings[SECTION.binds], TEXT.bind);
  const profiles = settings[SECTION.profiles];
  if (!isObject(profiles)) return found;
  for (const [name, profile] of Object.entries(profiles)) {
    if (!isObject(profile)) continue;
    addBinds(profile[SECTION.binds], (key) => TEXT.profileBind(name, key));
    const onload = onloadText(profile[SECTION.onload]);
    if (onload !== null) found.set(TEXT.profileOnload(name), onload);
  }
  return found;
}

export function newRiskyCommands(previous: unknown, next: unknown): RiskyCommand[] {
  const before = isObject(previous) ? commandsOf(previous) : new Map<string, string>();
  const after = isObject(next) ? commandsOf(next) : new Map<string, string>();
  return [...after].filter(([where, command]) => isRisky(command) && before.get(where) !== command).map(([where, command]) => ({ where, command }));
}

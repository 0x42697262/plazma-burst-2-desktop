import { CLIENT_DETAILS } from '#shared/clients/keys.ts';
import { CLIENT } from '#shared/features/keys.ts';
import { stringOf } from '#kernel/text/text-of.ts';
import { PAGE_GLOBAL } from '../../keys.ts';
import { FIND_NAMES_COMMAND, HEX_RADIX, NAMES_FILE, NAMES_NOT_LOADED, NON_ASCII, SADBURST_VERSION_PREFIX, UNICODE_ESCAPE_DIGITS, UNICODE_ESCAPE_PREFIX, ZERO_PAD, missingNameLabel, type NameKey } from './keys.ts';
import { TEXT } from './text.ts';
import { readGlobal, writeGlobal } from './globals.ts';

type Names = Readonly<Record<string, string | undefined>>;
type Callable = (...args: unknown[]) => unknown;

const loadedNames = Reflect.get(globalThis, PAGE_GLOBAL.names) as Names | undefined;

export const NAMES: Names = loadedNames ?? {};
export const SADBURST = stringOf(NAMES.version || '').startsWith(SADBURST_VERSION_PREFIX);
const PAGE_CLIENT = CLIENT_DETAILS[SADBURST ? CLIENT.sadburst : CLIENT.official];
export const CLIENT_TITLE = PAGE_CLIENT.title;
export const FIND_NAMES = FIND_NAMES_COMMAND + PAGE_CLIENT.runFlag;
export const namesMissing: readonly string[] = loadedNames ? Object.keys(NAMES).filter((key) => !NAMES[key]) : [NAMES_NOT_LOADED];

export function nameOf(key: NameKey): string {
  const name = NAMES[key];
  if (!name) throw new Error(TEXT.nameMissing(key, SADBURST ? NAMES_FILE.sadburst : NAMES_FILE.official, FIND_NAMES));
  return name;
}

export const read = (key: NameKey): unknown => readGlobal(nameOf(key));
export const write = (key: NameKey, value: unknown): void => { writeGlobal(nameOf(key), value); };
export const call = (key: NameKey, ...args: unknown[]): unknown => (read(key) as Callable)(...args);

export const escName = (key: NameKey): string => (NAMES[key] ?? missingNameLabel(key))
  .replace(NON_ASCII, (character) => UNICODE_ESCAPE_PREFIX + character.charCodeAt(0).toString(HEX_RADIX).padStart(UNICODE_ESCAPE_DIGITS, ZERO_PAD));

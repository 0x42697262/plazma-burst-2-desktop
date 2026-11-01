import { print } from '../../../../desktop/dev/console/ui/log.js';
import { COLOR } from '../../../../desktop/dev/console/core/colors.js';
import { SCHEMA, ALIASES, unphrase } from '../../../../desktop/dev/console/state/schema.js';
import { showKey, baseKey, GAME_KEYS } from '../../../../desktop/dev/console/state/keys.js';
import { hotkeyOf } from '../../../../desktop/dev/console/state/hotkeys.js';
import { runWords } from '../../../../desktop/dev/console/commands/registry.js';
import { splitCommands } from '../../../../desktop/dev/console/dispatch.js';
import { FIRST_CAPTURE, QUOTED_COMMAND, WHITESPACE, WORD_SEPARATOR } from './keys.ts';
import { COMMAND_TEXT as TEXT } from './text.ts';

type Hotkey = { what: string; key: string };

const startsSomething = (word: string): boolean => {
  const lower = word.toLowerCase();
  return (runWords as () => string[])().includes(lower) || Object.hasOwn(SCHEMA, lower) || Object.hasOwn(ALIASES, lower);
};
const keyText = (key: string): string => (showKey as (key: string) => string)(key);

export function commandText(words: readonly string[], usage: string): string {
  const command = words.join(WORD_SEPARATOR).replace(QUOTED_COMMAND, FIRST_CAPTURE).trim();
  const parts = (splitCommands as (line: string) => string[])(command);
  if (!parts.length) throw new Error(usage);
  for (const part of parts) {
    const first = (unphrase as (text: string) => string)(part).split(WHITESPACE)[0] ?? '';
    if (!startsSomething(first)) throw new Error(TEXT.unknownStart(first, part));
  }
  return command;
}

export function warnKeyUses(key: string): void {
  const hotkey = (hotkeyOf as (key: string) => Hotkey | null)(key);
  if (hotkey) print(TEXT.hotkeyWins(keyText(key), hotkey.what, hotkey.key), COLOR.warn);
  const base = (baseKey as (key: string) => string)(key);
  const gameUse = (GAME_KEYS as Record<string, string | undefined>)[base];
  if (gameUse !== undefined) print(TEXT.gameKey(keyText(key), base === key ? '' : keyText(base), gameUse), COLOR.warn);
}

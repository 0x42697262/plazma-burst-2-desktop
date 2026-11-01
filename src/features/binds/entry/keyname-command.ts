import { print } from '../../../../desktop/dev/console/ui/log.js';
import { COLOR } from '../../../../desktop/dev/console/core/colors.js';
import { COMMAND, SINGLE_CHARACTER } from '../keys.ts';
import { TEXT } from '../text.ts';
import { bindStore, keyNames, type KeyEvent } from '../adapters/keys.ts';

let stopWaiting: (() => void) | null = null;

function usesOf(name: string): string[] {
  if (name === keyNames.toggle) return [TEXT.togglesConsole];
  const uses: string[] = [];
  const hotkey = keyNames.hotkey(name);
  if (hotkey) uses.push(TEXT.hotkeyUse(hotkey.what, hotkey.key));
  const bound = bindStore.active(name);
  if (bound?.profile) uses.push(TEXT.profileBound(bound.profile, bound.command));
  const yours = bindStore.get(name);
  if (yours) uses.push(TEXT.yoursBound(!!bound?.profile, yours));
  const base = keyNames.base(name);
  const gameUse = keyNames.gameUse(base);
  if (gameUse !== undefined) uses.push(TEXT.gameKey(base === name ? '' : keyNames.show(base), gameUse));
  return uses;
}

function report(event: KeyEvent | null): void {
  stopWaiting = null;
  if (!event) {
    print(TEXT.keynameCancelled, COLOR.notice);
    return;
  }
  const name = keyNames.ofEvent(event);
  const typesCharacter = event.key !== undefined && event.key.length === SINGLE_CHARACTER;
  print(keyNames.show(name), COLOR.title);
  print(TEXT.typedLine(typesCharacter ? TEXT.typesCharacter(event.key ?? '') : TEXT.keyNamed(event.key ?? ''), event.code ?? ''), COLOR.hint);
  let isBindable = true;
  try {
    keyNames.parse(name);
  } catch (error) {
    isBindable = false;
    print(TEXT.cannotBind((error as Error).message), COLOR.warn);
  }
  for (const use of usesOf(name)) print(TEXT.useLine(use));
  if (isBindable) print(TEXT.bindHint(keyNames.show(name)), COLOR.ok);
}

function keyname(args: readonly string[]): void {
  if (args.length) throw new Error(TEXT.keynameUsage);
  if (stopWaiting) stopWaiting();
  stopWaiting = keyNames.catchNextKey(report);
  print(TEXT.keynamePrompt, COLOR.notice);
}

export const keynameCommand = Object.freeze({
  name: COMMAND.keyname,
  aliases: COMMAND.keynameAliases,
  usage: TEXT.keyname.usage,
  desc: TEXT.keyname.desc,
  help: { about: TEXT.keyname.about, examples: TEXT.keyname.examples, notes: TEXT.keyname.notes, see: TEXT.keyname.see },
  run: keyname,
});

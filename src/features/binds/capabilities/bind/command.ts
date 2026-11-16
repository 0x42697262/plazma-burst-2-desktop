import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { commandText, warnKeyUses } from '#console/kernel/commands/command-text.ts';
import { BIND_ARGUMENTS_MIN, KEY_WIDTH } from '../../constants.ts';
import { ALL_WORDS, COMMAND, HOLD_OPTION, KEY_ARGUMENT, KEY_ARGUMENT_AFTER_HOLD } from '../../keys.ts';
import { holdCommands } from '#console/kernel/commands/hold.ts';
import { TEXT } from './text.ts';
import { bindStore, keyNames } from '../../adapters/keys.ts';

type Args = readonly string[];

const shownKey = (key: string): string => (bindStore.isHeld(key) ? TEXT.held(keyNames.show(key)) : keyNames.show(key));

function listBinds(): void {
  const keys = bindStore.keys();
  const profile = keyNames.activeProfile();
  const mapKeys = profile ? Object.keys(profile.binds).sort() : [];
  if (!keys.length && !mapKeys.length) {
    print(TEXT.noBinds, COLOR.notice);
    return;
  }
  if (keys.length) {
    print(TEXT.yoursTitle(keys.length), COLOR.title);
    for (const key of keys) print(TEXT.row(shownKey(key).padEnd(KEY_WIDTH), bindStore.get(key) ?? '', mapKeys.includes(key)));
  }
  if (profile && mapKeys.length) {
    print(TEXT.profileTitle(profile.name, mapKeys.length), COLOR.title);
    for (const key of mapKeys) print(TEXT.profileRow(keyNames.show(key).padEnd(KEY_WIDTH), profile.binds[key] ?? ''));
  }
}

export function bindKey(allArgs: Args): void {
  const isHold = allArgs[0]?.toLowerCase() === HOLD_OPTION;
  const args = isHold ? allArgs.slice(1) : allArgs;
  const [word] = args;
  if (isHold && args.length < BIND_ARGUMENTS_MIN) throw new Error(TEXT.holdUsage);
  if (word === undefined) {
    listBinds();
    return;
  }
  const key = keyNames.parse(word);
  const old = bindStore.get(key);
  if (args.length < BIND_ARGUMENTS_MIN) {
    print(old ? TEXT.shown(keyNames.show(key), old) : TEXT.notBound(keyNames.show(key)), old ? undefined : COLOR.notice);
    return;
  }
  const command = commandText(args.slice(1), TEXT.bindUsage);
  const held = isHold ? holdCommands(command) : null;
  if (isHold && !held) throw new Error(TEXT.notHoldable(command));
  bindStore.set(key, command, isHold);
  print(TEXT.bound(isHold ? TEXT.held(keyNames.show(key)) : keyNames.show(key), command, old), COLOR.ok);
  if (held) print(TEXT.boundHeld(keyNames.show(key), held.press, held.release), COLOR.hint);
  const now = bindStore.active(key);
  if (now?.profile) print(TEXT.profileWins(now.profile, keyNames.show(key)), COLOR.warn);
  warnKeyUses(key);
}

export function unbindKey(args: Args): void {
  const [word] = args;
  if (args.length !== 1 || word === undefined) throw new Error(TEXT.unbindUsage);
  if (ALL_WORDS.includes(word.toLowerCase())) {
    print(TEXT.removedAll(bindStore.clear()), COLOR.ok);
    return;
  }
  const key = keyNames.parse(word);
  const old = bindStore.get(key);
  if (!old) {
    print(TEXT.notBound(keyNames.show(key)), COLOR.notice);
    return;
  }
  print(TEXT.unbound(keyNames.show(key), old), COLOR.ok);
  bindStore.remove(key);
}

export const bindCommands = Object.freeze([
  {
    name: COMMAND.bind,
    aliases: COMMAND.bindAliases,
    usage: TEXT.bind.usage,
    keyArg: (words: readonly string[]): number => (words[1]?.toLowerCase() === HOLD_OPTION ? KEY_ARGUMENT_AFTER_HOLD : KEY_ARGUMENT),
    desc: TEXT.bind.desc,
    help: { about: TEXT.bind.about, args: TEXT.bind.args, examples: TEXT.bind.examples, notes: TEXT.bind.notes, see: TEXT.bind.see },
    run: bindKey,
  },
  {
    name: COMMAND.unbind,
    usage: TEXT.unbind.usage,
    keyArg: KEY_ARGUMENT,
    desc: TEXT.unbind.desc,
    help: { args: TEXT.unbind.args, see: TEXT.unbind.see },
    run: unbindKey,
  },
]);

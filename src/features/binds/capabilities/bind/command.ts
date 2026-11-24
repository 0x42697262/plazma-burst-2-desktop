import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { commandText, warnKeyUses } from '#console/kernel/commands/command-text.ts';
import { BIND_ARGUMENTS_MIN, KEY_WIDTH } from '../../constants.ts';
import { ALL_WORDS, BIND_OPTIONS, COMMAND, HOLD_OPTION, KEY_ARGUMENT, PASS_OPTION, TOGGLE_CHOICES_MIN, TOGGLE_OPTION } from '../../keys.ts';
import { holdCommands } from '#console/kernel/commands/hold.ts';
import { QUOTE, WORD_SEPARATOR } from '#console/kernel/commands/keys.ts';
import { forgetToggleStep, joinToggleChoices, toggleChoices } from '#console/kernel/commands/toggle.ts';
import { CHAIN_JOIN } from '#console/kernel/state/keys.ts';
import { TEXT } from './text.ts';
import { bindStore, keyNames } from '../../adapters/keys.ts';

type Args = readonly string[];

const marked = (key: string, isHeld: boolean, isPass: boolean, isToggle: boolean): string => TEXT.marked(keyNames.show(key), [isHeld ? TEXT.holdMark : '', isToggle ? TEXT.toggleMark : '', isPass ? TEXT.passMark : ''].filter(Boolean));
const shownKey = (key: string): string => marked(key, bindStore.isHeld(key), bindStore.isPass(key), bindStore.isToggle(key));

function leadingOptions(allArgs: Args): { options: Set<string>; args: Args } {
  const options = new Set<string>();
  let index = 0;
  while (index < allArgs.length && BIND_OPTIONS.includes(String(allArgs[index]).toLowerCase())) options.add(String(allArgs[index++]).toLowerCase());
  return { options, args: allArgs.slice(index) };
}

function quotedChoices(text: string): string[] | null {
  const choices: string[] = [];
  let position = 0;
  while (position < text.length) {
    if (text[position] !== QUOTE) return null;
    const start = position + 1;
    let end = -1;
    for (let index = start; index < text.length && end < 0; index++) {
      if (text[index] !== QUOTE) continue;
      const after = text.slice(index + 1).trimStart();
      if (after === '' || after.startsWith(QUOTE)) end = index;
    }
    if (end < 0) return null;
    choices.push(text.slice(start, end).trim());
    position = end + 1;
    while (text[position] === ' ') position++;
  }
  return choices;
}

function toggleCommand(words: Args): string {
  const text = words.join(WORD_SEPARATOR).trim();
  const choices = quotedChoices(text);
  if (!choices || choices.length < TOGGLE_CHOICES_MIN || choices.includes('')) throw new Error(TEXT.toggleUsage);
  for (const choice of choices) {
    commandText([choice], TEXT.toggleUsage);
  }
  return joinToggleChoices(choices);
}

const shownCommand = (key: string, command: string): string => (bindStore.isToggle(key) ? toggleChoices(command).map((choice) => `${QUOTE}${choice}${QUOTE}`).join(' ') : command);

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
    for (const key of keys) print(TEXT.row(shownKey(key).padEnd(KEY_WIDTH), shownCommand(key, bindStore.get(key) ?? ''), mapKeys.includes(key)));
  }
  if (profile && mapKeys.length) {
    print(TEXT.profileTitle(profile.name, mapKeys.length), COLOR.title);
    for (const key of mapKeys) print(TEXT.profileRow(keyNames.show(key).padEnd(KEY_WIDTH), profile.binds[key] ?? ''));
  }
}

export function bindKey(allArgs: Args): void {
  const { options, args } = leadingOptions(allArgs);
  const isHold = options.has(HOLD_OPTION);
  const isPass = options.has(PASS_OPTION);
  const isToggle = options.has(TOGGLE_OPTION);
  const [word] = args;
  if (isToggle && isHold) throw new Error(TEXT.toggleHold);
  if (options.size && args.length < BIND_ARGUMENTS_MIN) throw new Error(isToggle ? TEXT.toggleUsage : TEXT.holdUsage);
  if (word === undefined) {
    listBinds();
    return;
  }
  const key = keyNames.parse(word);
  const old = bindStore.get(key);
  if (args.length < BIND_ARGUMENTS_MIN) {
    print(old ? TEXT.shown(keyNames.show(key), shownCommand(key, old)) : TEXT.notBound(keyNames.show(key)), old ? undefined : COLOR.notice);
    return;
  }
  const command = isToggle ? toggleCommand(args.slice(1)) : commandText(args.slice(1), TEXT.bindUsage);
  const held = isHold ? holdCommands(command) : null;
  if (isHold && !held) throw new Error(TEXT.notHoldable(command));
  bindStore.set(key, command, isHold, isPass, isToggle);
  forgetToggleStep(key);
  print(TEXT.bound(marked(key, isHold, isPass, isToggle), isToggle ? toggleChoices(command).map((choice) => `${QUOTE}${choice}${QUOTE}`).join(' ') : command, old), COLOR.ok);
  if (held) print(TEXT.boundHeld(keyNames.show(key), held.press, held.release), COLOR.hint);
  if (isToggle) print(TEXT.boundToggle(keyNames.show(key), toggleChoices(command).length), COLOR.hint);
  const now = bindStore.active(key);
  if (now?.profile) print(TEXT.profileWins(now.profile, keyNames.show(key)), COLOR.warn);
  if (!isPass) warnKeyUses(key);
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
    keyArg: (words: readonly string[]): number => KEY_ARGUMENT + leadingOptions(words.slice(KEY_ARGUMENT)).options.size,
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

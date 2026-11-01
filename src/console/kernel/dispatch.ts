import { stringOf } from '#kernel/text/text-of.ts';
import { print } from './ui/log.ts';
import { COLOR } from './core/keys.ts';
import { plural, isHelpArg } from './core/words.ts';
import { game } from './game/bindings.ts';
import { SCHEMA, resolveKey, keyClientOnly, unphrase } from './state/schema.ts';
import { findRunnable, findSubcommand, reachOf, type Command, type CommandContext, type Reach } from './commands/registry.ts';
import { printTopicHelp } from './commands/help.ts';
import { runKey, KEY_SETTING_ARGUMENT } from './commands/settings.ts';
import { askingToBypass, answerBypass } from './danger/bypass.ts';
import { BYPASSED_LINES, NOT_BYPASSED_LINE } from './danger/text.ts';
import { ANONYMOUS_FRAME, CHAIN_SEPARATOR, KEY_TYPE, MODIFIERS_ONLY, QUOTE, WHITESPACE } from './commands/keys.ts';
import { DISPATCH_TEXT as TEXT } from './commands/text.ts';

type Extra = { source?: string; chained?: boolean };

function keyArgOf(words: readonly string[]): number | undefined {
  const command = findRunnable(words[0]);
  const subcommand = command && words.length > 1 ? findSubcommand(command, words[1]) : undefined;
  const definition = subcommand && subcommand.keyArg !== undefined ? subcommand : command;
  if (definition) return typeof definition.keyArg === 'function' ? definition.keyArg(words) : definition.keyArg;
  const key = resolveKey(words[0]);
  return key && SCHEMA[key].type === KEY_TYPE ? KEY_SETTING_ARGUMENT : undefined;
}

function atKeyName(current: string): boolean {
  const words = current.trimStart().split(WHITESPACE);
  const typing = words.pop() ?? '';
  return words.length > 0 && MODIFIERS_ONLY.test(typing) && keyArgOf(words) === words.length;
}

export function splitCommands(text: string): string[] {
  const words = text.trim().split(WHITESPACE);
  const command = findRunnable(words[0]);
  if (command && (command.rawLine || findSubcommand(command, words[1])?.rawLine)) return [text];
  const parts: string[] = [];
  let current = '';
  let quoted = false;
  for (const character of text) {
    if (character === QUOTE) quoted = !quoted;
    if (character === CHAIN_SEPARATOR && !quoted && !atKeyName(current)) {
      parts.push(current);
      current = '';
      continue;
    }
    current += character;
  }
  parts.push(current);
  return parts.map((part) => part.trim()).filter(Boolean);
}

function noteReach(command: Command | undefined, word: string, args: string[]): void {
  if (!game.isMP() || isHelpArg(args)) return;
  let reach: Reach;
  if (!command) {
    const key = resolveKey(word);
    const reason = keyClientOnly(key);
    reach = reason && key ? [key, reason] : undefined;
  } else {
    const subcommand = findSubcommand(command, args[0]);
    if (subcommand?.reportsReach) return;
    reach = reachOf(command, args);
  }
  if (reach) print([[TEXT.clientOnlyNote(reach[0], reach[1]), COLOR.warn, true]]);
}

function dispatch(command: Command | undefined, word: string, args: string[], rest: string, extra: Extra): void {
  if (!command) {
    const key = resolveKey(word);
    if (!key) throw new Error(TEXT.unknownCommand(word));
    runKey(key, args);
    return;
  }
  if (isHelpArg(args) && !command.handlesHelp) {
    printTopicHelp(command.name);
    return;
  }
  const subcommand = findSubcommand(command, args[0]);
  const context: CommandContext = { rest, ...extra };
  if (subcommand) subcommand.run?.(args.slice(1), { ...context, verb: (args[0] ?? '').toLowerCase() });
  else command.run?.(args, context);
}

function noteReachQuietly(command: Command | undefined, word: string, args: string[]): void {
  try {
    noteReach(command, word, args);
  } catch {
    return;
  }
}

function runOne(text: string, extra: Extra): boolean {
  const [first = '', ...args] = text.split(WHITESPACE);
  const word = first.toLowerCase();
  const rest = text.slice(first.length).trim();
  const command = findRunnable(word);
  noteReachQuietly(command, word, args);
  try {
    dispatch(command, word, args, rest, extra);
    return true;
  } catch (error) {
    print(TEXT.error(stringOf((error as Error | null)?.message)), COLOR.error);
    return false;
  }
}

export function maskLine(line: unknown): string {
  const text = stringOf(line || '');
  const command = findRunnable(text.trim().split(WHITESPACE)[0]);
  return command && typeof command.mask === 'function' ? command.mask(text) : text;
}

export function run(line: unknown, source?: string): void {
  const text = stringOf(line || '').trim();
  if (!text) return;
  if (new Error().stack?.includes(ANONYMOUS_FRAME)) {
    setTimeout(() => { run(line, source); }, 0);
    return;
  }
  print(source ? TEXT.echoSourced(source, maskLine(text)) : TEXT.echo(maskLine(text)), COLOR.title);
  if (!source && askingToBypass()) {
    if (answerBypass(text)) for (const bypassedLine of BYPASSED_LINES) print(bypassedLine, COLOR.error);
    else print(NOT_BYPASSED_LINE, COLOR.notice);
    return;
  }
  const parts = splitCommands(text);
  for (let index = 0; index < parts.length; index++) {
    const part = parts[index] ?? '';
    if (parts.length > 1) print(TEXT.chainStep(index + 1, parts.length, part), COLOR.muted);
    if (!runOne(unphrase(part), { source, chained: parts.length > 1 })) {
      const left = parts.length - 1 - index;
      if (left) print(TEXT.stopped(plural(left, TEXT.commandNoun)), COLOR.warn);
      return;
    }
  }
}

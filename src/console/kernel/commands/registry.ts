import { stringOf } from '#kernel/text/text-of.ts';
import { allowedHere, capabilityOn, type Availability } from '../core/mode.ts';
import { REGISTRY_TEXT as TEXT } from './text.ts';

export type HelpPair = readonly [string, string];
export type CommandHelp = Readonly<{
  about?: readonly string[];
  args?: readonly HelpPair[];
  examples?: readonly HelpPair[];
  notes?: readonly string[];
  see?: readonly string[];
  also?: readonly string[];
}>;
export type CommandContext = { rest: string; verb?: string; source?: string; chained?: boolean };
export type Reach = readonly [subject: string, reason: string] | undefined | null | false | '';
export type CommandDefinition = Availability & {
  name: string;
  aliases?: readonly string[];
  usage?: string;
  desc?: string;
  help?: CommandHelp;
  renderHelp?: () => void;
  clientOnly?: string | ((args: readonly string[]) => Reach);
  handlesHelp?: boolean;
  rawLine?: boolean;
  keyArg?: number | ((words: readonly string[]) => number | undefined);
  topicOnly?: boolean;
  reportsReach?: boolean;
  mask?: (line: string) => string;
  complete?: (argument: number) => readonly string[] | null | undefined;
  run?: (args: string[], context: CommandContext) => unknown;
  subcommands?: readonly CommandDefinition[];
  container?: boolean;
  ownUsage?: string;
};
export type Command = Omit<CommandDefinition, 'aliases' | 'subcommands'> & { aliases: readonly string[]; subcommands: Command[] };
export type HelpEntry = { id: string; def: Command; also: string[] };

const commands: Command[] = [];
const byWord = new Map<string, Command>();

const containerOnly = (command: Command) => (): never => {
  throw new Error(TEXT.onlySubcommands(command.name, command.subcommands.map((subcommand) => subcommand.name)));
};

const normalize = (definition: CommandDefinition): Command => ({ ...definition, aliases: definition.aliases ?? [], subcommands: [] });

export function register(...definitions: readonly CommandDefinition[]): void {
  for (const definition of definitions) {
    if (!allowedHere(definition)) continue;
    const command = normalize(definition);
    command.subcommands = (definition.subcommands ?? []).filter((subcommand) => allowedHere(subcommand) && capabilityOn(subcommand)).map(normalize);
    const isTrimmed = command.subcommands.length < (definition.subcommands ?? []).length;
    const isOwnRunOn = !definition.container && capabilityOn(definition);
    if (isTrimmed || !isOwnRunOn) command.usage = TEXT.shellUsage(command.name, isOwnRunOn ? definition.ownUsage ?? null : null, command.subcommands.map((subcommand) => subcommand.name));
    if (!isOwnRunOn && !command.subcommands.length) continue;
    if (!isOwnRunOn) command.run = containerOnly(command);
    const subcommandWords = new Set<string>();
    for (const subcommand of command.subcommands) {
      for (const word of [subcommand.name, ...subcommand.aliases]) {
        if (subcommandWords.has(word)) throw new Error(TEXT.subcommandTwice(command.name, word));
        subcommandWords.add(word);
      }
    }
    for (const word of [command.name, ...command.aliases]) {
      if (byWord.has(word)) throw new Error(TEXT.commandTwice(word));
      byWord.set(word, command);
    }
    commands.push(command);
  }
}

export const findCommand = (word: unknown): Command | undefined => byWord.get(stringOf(word ?? '').toLowerCase());
export const findRunnable = (word: unknown): Command | undefined => {
  const command = findCommand(word);
  return command && !command.topicOnly ? command : undefined;
};

export const findSubcommand = (command: Command, verb: unknown): Command | undefined => {
  const typed = stringOf(verb ?? '').toLowerCase();
  return typed ? command.subcommands.find((subcommand) => subcommand.name === typed || subcommand.aliases.includes(typed)) : undefined;
};

export function findSubcommandAnywhere(verb: string): { cmd: Command; sub: Command } | null {
  for (const command of commands) {
    const subcommand = findSubcommand(command, verb);
    if (subcommand) return { cmd: command, sub: subcommand };
  }
  return null;
}

export const runWords = (): string[] => commands.filter((command) => !command.topicOnly).flatMap((command) => [command.name, ...command.aliases]);
export const commandNames = (): string[] => commands.filter((command) => !command.topicOnly).map((command) => command.name);

export function helpEntries(): HelpEntry[] {
  const entries: HelpEntry[] = [];
  for (const command of commands) {
    entries.push({ id: command.name, def: command, also: [...command.aliases, ...(command.help?.also ?? [])] });
    for (const subcommand of command.subcommands) {
      entries.push({
        id: TEXT.subcommandId(command.name, subcommand.name),
        def: subcommand,
        also: [...subcommand.aliases.map((alias) => TEXT.subcommandId(command.name, alias)), ...(subcommand.help?.also ?? [])],
      });
    }
  }
  return entries;
}

export const findHelpEntry = (id: string): HelpEntry | undefined => helpEntries().find((entry) => entry.id === id);

export function reachOf(definition: CommandDefinition, args: readonly string[]): Reach {
  const clientOnly = definition.clientOnly;
  if (!clientOnly) return undefined;
  return typeof clientOnly === 'function' ? clientOnly(args) : [definition.name, clientOnly];
}

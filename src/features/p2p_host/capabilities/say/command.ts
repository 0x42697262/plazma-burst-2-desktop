import type { CommandDefinition } from '#console/kernel/commands/registry.ts';
import { SERVER_COMMAND, WORD_SEPARATOR } from '../../keys.ts';
import { say } from '../../services/host.ts';
import { COMMAND } from './keys.ts';
import { TEXT } from './text.ts';

function runSay(args: string[]): void {
  if (!args.length) throw new Error(TEXT.sayUsage);
  say(args.join(WORD_SEPARATOR));
}

export const sayCommands: readonly CommandDefinition[] = Object.freeze([
  { parent: SERVER_COMMAND.name, name: COMMAND.name, ...TEXT.subcommand, rawLine: true, run: runSay },
  { name: COMMAND.name, server: true, ...TEXT.shortcut, rawLine: true, run: runSay },
]);

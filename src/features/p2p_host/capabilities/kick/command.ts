import type { CommandDefinition } from '#console/kernel/commands/registry.ts';
import { SERVER_COMMAND, WORD_SEPARATOR } from '../../keys.ts';
import { kick } from '../../services/host.ts';
import { findPlayer } from '../../services/console-view.ts';
import { COMMAND } from './keys.ts';
import { TEXT } from './text.ts';

const runKick = (args: string[]): void => kick(findPlayer(args.join(WORD_SEPARATOR)));

export const kickCommands: readonly CommandDefinition[] = Object.freeze([
  { parent: SERVER_COMMAND.name, name: COMMAND.name, ...TEXT.subcommand, run: runKick },
  { name: COMMAND.name, server: true, ...TEXT.shortcut, run: runKick },
]);

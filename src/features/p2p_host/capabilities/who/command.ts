import type { CommandDefinition } from '#console/kernel/commands/registry.ts';
import { SERVER_COMMAND } from '../../keys.ts';
import { printWho } from '../../services/console-view.ts';
import { COMMAND } from './keys.ts';
import { TEXT } from './text.ts';

export const whoCommands: readonly CommandDefinition[] = Object.freeze([
  { parent: SERVER_COMMAND.name, name: COMMAND.name, aliases: COMMAND.aliases, ...TEXT.subcommand, run: printWho },
  { name: COMMAND.name, server: true, ...TEXT.shortcut, run: printWho },
]);

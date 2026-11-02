import { SERVER_COMMAND } from '../../keys.ts';
import { sendOwner } from '../../services/console-view.ts';
import { COMMAND } from './keys.ts';
import { TEXT } from './text.ts';

function runMinReputation(args: string[]): void {
  const reputation = Number(args[0]);
  if (!Number.isInteger(reputation) || reputation < 0) throw new Error(TEXT.minReputationUsage);
  sendOwner(TEXT.ownerLine(reputation));
}

export const minReputationCommand = Object.freeze({ parent: SERVER_COMMAND.name, name: COMMAND.name, aliases: COMMAND.aliases, ...TEXT.subcommand, run: runMinReputation });

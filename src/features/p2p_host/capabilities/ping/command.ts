import { PING_OFF, SERVER_COMMAND } from '../../keys.ts';
import { sendOwner } from '../../services/console-view.ts';
import { COMMAND } from './keys.ts';
import { TEXT } from './text.ts';

function runPing(args: string[]): void {
  const word = (args[0] || '').toLowerCase();
  const ms = word === PING_OFF ? 0 : Number(word);
  if (!Number.isInteger(ms) || ms < 0) throw new Error(TEXT.pingUsage);
  sendOwner(TEXT.ownerLine(ms));
}

export const pingCommand = Object.freeze({ parent: SERVER_COMMAND.name, name: COMMAND.name, ...TEXT.subcommand, run: runPing });

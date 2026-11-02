import { PING_ACTIONS, SERVER_COMMAND } from '../../keys.ts';
import { sendOwner } from '../../services/console-view.ts';
import { COMMAND } from './keys.ts';
import { TEXT } from './text.ts';

function runPingAction(args: string[]): void {
  const action = args[0];
  if (action === undefined || !PING_ACTIONS.includes(action)) throw new Error(TEXT.pingActionUsage(PING_ACTIONS));
  sendOwner(TEXT.ownerLine(action));
}

export const pingActionCommand = Object.freeze({ parent: SERVER_COMMAND.name, name: COMMAND.name, usage: TEXT.subcommand.usage(PING_ACTIONS), desc: TEXT.subcommand.desc, run: runPingAction });

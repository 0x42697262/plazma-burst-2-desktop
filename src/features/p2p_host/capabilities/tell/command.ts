import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { SERVER_COMMAND, WORD_SEPARATOR } from '../../keys.ts';
import { playerName, tell } from '../../services/host.ts';
import { findPlayer } from '../../services/console-view.ts';
import { COMMAND } from './keys.ts';
import { TEXT } from './text.ts';

function runTell(args: string[]): void {
  const row = findPlayer(args[0]);
  const text = args.slice(1).join(WORD_SEPARATOR);
  if (!text) throw new Error(TEXT.tellUsage);
  tell(row, text);
  print(TEXT.toPlayer(playerName(row), text), COLOR.ok);
}

export const tellCommand = Object.freeze({ parent: SERVER_COMMAND.name, name: COMMAND.name, aliases: COMMAND.aliases, ...TEXT.subcommand, rawLine: true, run: runTell });

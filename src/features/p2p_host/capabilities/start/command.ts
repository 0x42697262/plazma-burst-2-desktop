import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { SERVER_COMMAND } from '../../keys.ts';
import { startAgain } from '../../services/host.ts';
import { COMMAND } from './keys.ts';
import { TEXT } from './text.ts';

function runStart(): void {
  startAgain();
  print(TEXT.starting, COLOR.ok);
}

export const startCommand = Object.freeze({ parent: SERVER_COMMAND.name, name: COMMAND.name, ...TEXT.subcommand, run: runStart });

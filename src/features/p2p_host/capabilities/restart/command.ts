import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { SERVER_COMMAND } from '../../keys.ts';
import { restart } from '../../services/host.ts';
import { COMMAND } from './keys.ts';
import { TEXT } from './text.ts';

function runRestart(): void {
  restart();
  print(TEXT.restarting, COLOR.ok);
}

export const restartCommand = Object.freeze({ parent: SERVER_COMMAND.name, name: COMMAND.name, ...TEXT.subcommand, run: runRestart });

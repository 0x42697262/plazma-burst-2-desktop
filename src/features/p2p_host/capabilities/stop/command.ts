import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { SERVER_COMMAND } from '../../keys.ts';
import { stop } from '../../services/host.ts';
import { COMMAND } from './keys.ts';
import { TEXT } from './text.ts';

function runStop(): void {
  const wasRunning = stop();
  print(wasRunning ? TEXT.matchEnded : TEXT.stopped, COLOR.ok);
}

export const stopCommand = Object.freeze({ parent: SERVER_COMMAND.name, name: COMMAND.name, ...TEXT.subcommand, run: runStop });

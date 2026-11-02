import { OWNER_COMMAND, SERVER_COMMAND } from '../../keys.ts';
import { owner } from '../../services/console-view.ts';
import { COMMAND } from './keys.ts';
import { TEXT } from './text.ts';

export const swapCommand = Object.freeze({ parent: SERVER_COMMAND.name, name: COMMAND.name, ...TEXT.subcommand, run: owner(OWNER_COMMAND.swap) });

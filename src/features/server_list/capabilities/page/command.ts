import { COMMAND, OPERATION } from '../../keys.ts';
import { askServerList } from '../../adapters/route-client.ts';
import { reportingErrors } from '../../services/console-actions.ts';
import { PAGE_COMMAND } from './keys.ts';
import { PAGE_TEXT as TEXT } from './text.ts';

export const pageCommand = Object.freeze({
  parent: COMMAND.name,
  name: PAGE_COMMAND.name,
  aliases: PAGE_COMMAND.aliases,
  usage: TEXT.usage,
  desc: TEXT.desc,
  help: { about: TEXT.about, examples: TEXT.examples },
  run: reportingErrors(async () => { await askServerList(OPERATION.openList); }),
});

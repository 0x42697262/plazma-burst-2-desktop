import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { COMMAND, OPERATION, WORD_SEPARATOR } from '../../keys.ts';
import { pickServer, type ServerList } from '../../domain/command-words.ts';
import { askServerList } from '../../adapters/route-client.ts';
import { reportingErrors } from '../../services/console-actions.ts';
import { REMOVE_COMMAND } from './keys.ts';
import { REMOVE_TEXT as TEXT } from './text.ts';

async function remove(args: readonly string[]): Promise<void> {
  const server = pickServer(await askServerList<ServerList>(OPERATION.list), args.join(WORD_SEPARATOR));
  if (server.official) throw new Error(TEXT.officialStays);
  await askServerList(OPERATION.remove, server.id);
  print(TEXT.removed(server.name), COLOR.ok);
}

export const removeCommand = Object.freeze({
  parent: COMMAND.name, name: REMOVE_COMMAND.name, aliases: REMOVE_COMMAND.aliases, usage: TEXT.usage, desc: TEXT.desc, help: { about: TEXT.about }, run: reportingErrors(remove),
});

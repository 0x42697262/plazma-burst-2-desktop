import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { COMMAND, OPERATION, WORD_SEPARATOR } from '../../keys.ts';
import { pickServer, type ServerList } from '../../domain/command-words.ts';
import { askServerList } from '../../adapters/route-client.ts';
import { reportingErrors } from '../../services/console-actions.ts';
import { CONNECT_COMMAND } from './keys.ts';
import { CONNECT_TEXT as TEXT } from './text.ts';

async function connect(args: readonly string[]): Promise<void> {
  const server = pickServer(await askServerList<ServerList>(OPERATION.list), args.join(WORD_SEPARATOR));
  print(TEXT.connecting(server.name), COLOR.ok);
  await askServerList(OPERATION.play, server.id);
}

export const connectCommand = Object.freeze({
  parent: COMMAND.name, name: CONNECT_COMMAND.name, aliases: CONNECT_COMMAND.aliases, usage: TEXT.usage, desc: TEXT.desc, help: { about: TEXT.about, examples: TEXT.examples }, run: reportingErrors(connect),
});

import { EDIT_WORDS } from '../../constants.ts';
import { COMMAND, OPERATION } from '../../keys.ts';
import { COMMAND_TEXT } from '../../text.ts';
import { parsePairs, pickServer, textAfterWords, type ServerList } from '../../domain/command-words.ts';
import { askServerList } from '../../adapters/route-client.ts';
import { reportingErrors, saveServer, type CommandContext } from '../../services/console-actions.ts';
import { EDIT_COMMAND } from './keys.ts';
import { EDIT_TEXT as TEXT } from './text.ts';

async function edit(args: readonly string[], { rest }: CommandContext): Promise<void> {
  const server = pickServer(await askServerList<ServerList>(OPERATION.list), args[0]);
  if (server.official) throw new Error(TEXT.officialNotEditable);
  const change = parsePairs(textAfterWords(rest, EDIT_WORDS));
  if (!Object.keys(change).length) throw new Error(TEXT.nothingToChange);
  await saveServer({ id: server.id, name: server.name, address: server.address, fingerprint: server.fingerprint ?? '', nickname: server.nickname ?? '', ...change }, TEXT.changedWord);
}

export const editCommand = Object.freeze({
  parent: COMMAND.name,
  name: EDIT_COMMAND.name,
  usage: TEXT.usage,
  desc: TEXT.desc,
  rawLine: true,
  help: { about: TEXT.about, examples: TEXT.examples, notes: [COMMAND_TEXT.passwordNote] },
  run: reportingErrors(edit),
});

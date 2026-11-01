import { print } from '../../../../desktop/dev/console/ui/log.js';
import { COLOR } from '../../../../desktop/dev/console/core/colors.js';
import { EDIT_WORDS, NAME_COLUMN_WIDTH, PING_GOOD_MS, PING_OK_MS, SUBCOMMAND_WORDS } from '../constants.ts';
import { COMMAND, FETCH_FINGERPRINT_WORD, MASKED_PASSWORD_REPLACEMENT, OFFICIAL_ID, OPERATION, PASSWORD_IN_LINE, WORD_SEPARATOR, hostPortOf } from '../keys.ts';
import { COMMAND_TEXT } from '../text.ts';
import { parsePairs, pickServer, textAfterWords, type ListedServer, type ServerList } from '../domain/command-words.ts';
import { askServerList } from '../adapters/route-client.ts';

type Status = { name?: string; description?: string; players?: number; max_players?: number; version?: string; password?: boolean };
type Check = { ping?: number | null; status?: Status; error?: string; pinned?: boolean };
type SaveAnswer = { errors?: string[]; server?: ListedServer & { hasPassword: boolean } };
type Row = (ListedServer | (ServerList['official'] & { address: string })) & { official?: boolean };
type CommandContext = { rest: string };
type Segment = [string, string];

function pingSegment(check: Check | undefined): Segment {
  const ping = check?.ping;
  if (ping === null || ping === undefined) return [COMMAND_TEXT.offline, COLOR.error];
  const milliseconds = Math.round(ping);
  const color = milliseconds < PING_GOOD_MS ? COLOR.ok : milliseconds < PING_OK_MS ? COLOR.warn : COLOR.error;
  return [COMMAND_TEXT.pingMs(milliseconds), color];
}

function descriptionOf(row: Row, check: Check): string {
  if (row.official) return (row as ServerList['official']).description;
  let description = check.status?.description ?? '';
  if (!check.status) description = check.pinned === false ? COMMAND_TEXT.certificateChanged : check.error || '';
  const needsPassword = !!check.status?.password && !(row as ListedServer).hasPassword;
  return COMMAND_TEXT.describeAs(description, (row as ListedServer).nickname ?? '', needsPassword);
}

async function listServers(): Promise<void> {
  const list = await askServerList<ServerList>(OPERATION.list);
  const rows: Row[] = [{ ...list.official, official: true, address: hostPortOf(list.official.host, list.official.port) }, ...list.servers];
  const checks = await Promise.all(rows.map((row) => askServerList<Check>(OPERATION.check, row.id).catch((error: unknown) => ({ ping: null, error: (error as Error).message }))));
  print(COMMAND_TEXT.listTitle, COLOR.title);
  rows.forEach((row, index) => {
    const check: Check = checks[index] ?? {};
    const number = row.official ? OFFICIAL_ID : String(index);
    const name = check.status?.name || row.name;
    const players = check.status ? COMMAND_TEXT.players(check.status.players ?? 0, check.status.max_players ?? 0) : COMMAND_TEXT.noPlayers;
    const here = list.last === row.id ? COMMAND_TEXT.lastPlayed : '';
    print([[COMMAND_TEXT.numberCell(number, NAME_COLUMN_WIDTH), COLOR.bright], [name, COLOR.plain], [COMMAND_TEXT.addressCell(row.address), COLOR.hint], pingSegment(check), [COMMAND_TEXT.playersCell(players, here), COLOR.hint]]);
    const description = descriptionOf(row, check);
    if (description) print(COMMAND_TEXT.descriptionLine(description), check.pinned === false ? COLOR.error : COLOR.hint);
    const version = check.status?.version;
    if (version && version !== list.gameVersion) print(COMMAND_TEXT.versionMismatch(version, list.gameVersion ?? ''), COLOR.warn);
  });
  for (const problem of list.problems) print(COMMAND_TEXT.fileProblem(problem), COLOR.warn);
}

async function saveServer(entry: Record<string, string>, what: string): Promise<void> {
  if (entry.fingerprint?.toLowerCase() === FETCH_FINGERPRINT_WORD) {
    if (!entry.address) throw new Error(COMMAND_TEXT.fetchNeedsAddress);
    entry.fingerprint = await askServerList<string>(OPERATION.fingerprint, entry.address);
    print(COMMAND_TEXT.fetchedFingerprint(entry.fingerprint), COLOR.warn);
  }
  const answer = await askServerList<SaveAnswer>(OPERATION.save, entry);
  if (answer.errors) {
    for (const error of answer.errors) print(COMMAND_TEXT.errorLine(error), COLOR.error);
    return;
  }
  const saved = answer.server;
  if (saved) print(COMMAND_TEXT.saved(what, saved.name, saved.address, saved.nickname ?? '', saved.hasPassword), COLOR.ok);
}

const reportingErrors = (action: (args: readonly string[], context: CommandContext) => Promise<void>) => (args: readonly string[], context: CommandContext): void => {
  action(args, context).catch((error: unknown) => print(COMMAND_TEXT.errorLine((error as Error).message), COLOR.error));
};

async function connect(args: readonly string[]): Promise<void> {
  const server = pickServer(await askServerList<ServerList>(OPERATION.list), args.join(WORD_SEPARATOR));
  print(COMMAND_TEXT.connecting(server.name), COLOR.ok);
  await askServerList(OPERATION.play, server.id);
}

async function edit(args: readonly string[], { rest }: CommandContext): Promise<void> {
  const server = pickServer(await askServerList<ServerList>(OPERATION.list), args[0]);
  if (server.official) throw new Error(COMMAND_TEXT.officialNotEditable);
  const change = parsePairs(textAfterWords(rest, EDIT_WORDS));
  if (!Object.keys(change).length) throw new Error(COMMAND_TEXT.nothingToChange);
  await saveServer({ id: server.id, name: server.name, address: server.address, fingerprint: server.fingerprint ?? '', nickname: server.nickname ?? '', ...change }, COMMAND_TEXT.changedWord);
}

async function remove(args: readonly string[]): Promise<void> {
  const server = pickServer(await askServerList<ServerList>(OPERATION.list), args.join(WORD_SEPARATOR));
  if (server.official) throw new Error(COMMAND_TEXT.officialStays);
  await askServerList(OPERATION.remove, server.id);
  print(COMMAND_TEXT.removed(server.name), COLOR.ok);
}

async function fingerprint(args: readonly string[]): Promise<void> {
  const [address] = args;
  if (!address) throw new Error(COMMAND_TEXT.fingerprintUsage);
  print(COMMAND_TEXT.fingerprintLine(address, await askServerList<string>(OPERATION.fingerprint, address)), COLOR.ok);
}

const { sub } = COMMAND_TEXT;

export const serversCommand = Object.freeze({
  name: COMMAND.name,
  aliases: COMMAND.aliases,
  remote: false,
  usage: COMMAND_TEXT.usage,
  desc: COMMAND_TEXT.description,
  help: { about: COMMAND_TEXT.about, examples: COMMAND_TEXT.examples, notes: COMMAND_TEXT.notes },
  subcommands: [
    { name: COMMAND.list, aliases: COMMAND.listAliases, usage: sub.list.usage, desc: sub.list.desc, help: { about: sub.list.about }, run: reportingErrors(listServers) },
    { name: COMMAND.connect, aliases: COMMAND.connectAliases, usage: sub.connect.usage, desc: sub.connect.desc, help: { about: sub.connect.about, examples: sub.connect.examples }, run: reportingErrors(connect) },
    { name: COMMAND.add, usage: sub.add.usage, desc: sub.add.desc, rawLine: true, help: { about: sub.add.about, examples: sub.add.examples }, run: reportingErrors((_args, { rest }) => saveServer(parsePairs(textAfterWords(rest, SUBCOMMAND_WORDS)), COMMAND_TEXT.savedWord)) },
    { name: COMMAND.edit, usage: sub.edit.usage, desc: sub.edit.desc, rawLine: true, help: { about: sub.edit.about, examples: sub.edit.examples }, run: reportingErrors(edit) },
    { name: COMMAND.remove, aliases: COMMAND.removeAliases, usage: sub.remove.usage, desc: sub.remove.desc, help: { about: sub.remove.about }, run: reportingErrors(remove) },
    { name: COMMAND.fingerprint, aliases: COMMAND.fingerprintAliases, usage: sub.fingerprint.usage, desc: sub.fingerprint.desc, help: { about: sub.fingerprint.about, examples: sub.fingerprint.examples }, run: reportingErrors(fingerprint) },
    { name: COMMAND.page, aliases: COMMAND.pageAliases, usage: sub.page.usage, desc: sub.page.desc, help: { about: sub.page.about }, run: reportingErrors(async () => { await askServerList(OPERATION.openList); }) },
  ],
  mask: (line: string): string => line.replace(PASSWORD_IN_LINE, MASKED_PASSWORD_REPLACEMENT),
  run: reportingErrors(async (args) => {
    const [word] = args;
    if (word) throw new Error(COMMAND_TEXT.unknownSubcommand(word));
    await listServers();
  }),
});

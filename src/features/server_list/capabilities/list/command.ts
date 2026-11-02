import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { NAME_COLUMN_WIDTH, PING_GOOD_MS, PING_OK_MS } from '../../constants.ts';
import { COMMAND, OFFICIAL_ID, OPERATION, hostPortOf } from '../../keys.ts';
import type { ListedServer, ServerList } from '../../domain/command-words.ts';
import { askServerList } from '../../adapters/route-client.ts';
import { reportingErrors } from '../../services/console-actions.ts';
import { LIST_COMMAND } from './keys.ts';
import { LIST_TEXT as TEXT } from './text.ts';

type Status = { name?: string; description?: string; players?: number; max_players?: number; version?: string; password?: boolean };
type Check = { ping?: number | null; status?: Status; error?: string; pinned?: boolean };
type Row = (ListedServer | (ServerList['official'] & { address: string })) & { official?: boolean };
type Segment = [string, string];

function pingSegment(check: Check | undefined): Segment {
  const ping = check?.ping;
  if (ping === null || ping === undefined) return [TEXT.offline, COLOR.error];
  const milliseconds = Math.round(ping);
  const color = milliseconds < PING_GOOD_MS ? COLOR.ok : milliseconds < PING_OK_MS ? COLOR.warn : COLOR.error;
  return [TEXT.pingMs(milliseconds), color];
}

function descriptionOf(row: Row, check: Check): string {
  if (row.official) return (row as ServerList['official']).description;
  let description = check.status?.description ?? '';
  if (!check.status) description = check.pinned === false ? TEXT.certificateChanged : check.error || '';
  const needsPassword = !!check.status?.password && !(row as ListedServer).hasPassword;
  return TEXT.describeAs(description, (row as ListedServer).nickname ?? '', needsPassword);
}

async function listServers(): Promise<void> {
  const list = await askServerList<ServerList>(OPERATION.list);
  const rows: Row[] = [{ ...list.official, official: true, address: hostPortOf(list.official.host, list.official.port) }, ...list.servers];
  const checks = await Promise.all(rows.map((row) => askServerList<Check>(OPERATION.check, row.id).catch((error: unknown) => ({ ping: null, error: (error as Error).message }))));
  print(TEXT.listTitle, COLOR.title);
  rows.forEach((row, index) => {
    const check: Check = checks[index] ?? {};
    const number = row.official ? OFFICIAL_ID : String(index);
    const name = check.status?.name || row.name;
    const players = check.status ? TEXT.players(check.status.players ?? 0, check.status.max_players ?? 0) : TEXT.noPlayers;
    const here = list.last === row.id ? TEXT.lastPlayed : '';
    print([[TEXT.numberCell(number, NAME_COLUMN_WIDTH), COLOR.bright], [name, COLOR.plain], [TEXT.addressCell(row.address), COLOR.hint], pingSegment(check), [TEXT.playersCell(players, here), COLOR.hint]]);
    const description = descriptionOf(row, check);
    if (description) print(TEXT.descriptionLine(description), check.pinned === false ? COLOR.error : COLOR.hint);
    const version = check.status?.version;
    if (version && version !== list.gameVersion) print(TEXT.versionMismatch(version, list.gameVersion ?? ''), COLOR.warn);
  });
  for (const problem of list.problems) print(TEXT.fileProblem(problem), COLOR.warn);
}

export const listCommands = Object.freeze([
  {
    parent: COMMAND.name,
    ownRun: true,
    usage: TEXT.usage,
    desc: TEXT.description,
    help: { about: TEXT.about, examples: TEXT.examples },
    run: reportingErrors(async (args) => {
      const [word] = args;
      if (word) throw new Error(TEXT.unknownSubcommand(word));
      await listServers();
    }),
  },
  { parent: COMMAND.name, name: LIST_COMMAND.name, aliases: LIST_COMMAND.aliases, usage: TEXT.list.usage, desc: TEXT.list.desc, help: { about: TEXT.list.about }, run: reportingErrors(listServers) },
]);

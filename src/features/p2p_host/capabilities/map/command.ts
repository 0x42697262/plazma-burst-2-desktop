import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { LOCAL_MAP_PREFIX, LOCAL_WORD, MAP_FILE_EXTENSION, SEE_ALSO_MAPS, SERVER_COMMAND, WORD_SEPARATOR } from '../../keys.ts';
import { COMMAND_TEXT as SHARED } from '../../text.ts';
import { dropLocalMap, hostStatus, ownerCommand } from '../../services/host.ts';
import { useLocalMap } from '../../services/host.ts';
import { COMMAND } from './keys.ts';
import { TEXT } from './text.ts';

function changeMap(args: string[]): void {
  const status = hostStatus();
  if (!args.length) {
    if (status.match) print(TEXT.mapNow(status.match.map_name, status.match.map_id, status.localMap));
    else print(SHARED.noMatch(status.phase), COLOR.notice);
    return;
  }
  if ((args[0] ?? '').toLowerCase() === LOCAL_WORD) {
    const name = args.slice(1).join(WORD_SEPARATOR).replace(LOCAL_MAP_PREFIX, '').replace(MAP_FILE_EXTENSION, '');
    if (!name) throw new Error(TEXT.mapLocalUsage);
    useLocalMap(name).catch((error: unknown) => print(SHARED.error((error as Error).message), COLOR.error));
    return;
  }
  const line = TEXT.ownerLine(args.join(WORD_SEPARATOR));
  const had = dropLocalMap();
  ownerCommand(line);
  print(TEXT.mapSent(line, had ? had.name : ''), COLOR.ok);
}

export const mapCommand = Object.freeze({
  parent: SERVER_COMMAND.name,
  name: COMMAND.name,
  usage: TEXT.subcommand.usage,
  desc: TEXT.subcommand.desc,
  help: { about: TEXT.subcommand.about, examples: TEXT.subcommand.examples, see: SEE_ALSO_MAPS },
  run: changeMap,
});

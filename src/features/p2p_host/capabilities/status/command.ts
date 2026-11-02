import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { SERVER_COMMAND } from '../../keys.ts';
import { PHASE, hostPage, hostStatus } from '../../services/host.ts';
import { printWho } from '../../services/console-view.ts';
import { COMMAND } from './keys.ts';
import { TEXT } from './text.ts';

function printStatus(): void {
  const status = hostStatus();
  const { match: planned, server } = hostPage();
  print(TEXT.statusHead(status.phase, status.seconds, status.restartIn), COLOR.title);
  if (status.last && status.phase !== PHASE.running) print(TEXT.statusLast(status.last), COLOR.hint);
  const settings = status.settings || planned;
  print(TEXT.statusMatch(settings.title, settings.game_type, settings.max_players, !!settings.password));
  if (status.match) print(TEXT.statusMapLive(status.match.map_name, status.match.map_id, status.localMap));
  else print(TEXT.statusMapPlanned(settings.map_id, status.localMap));
  print(TEXT.statusRegion(settings.p2p_region));
  print(TEXT.statusAllow(server.allow));
  print(TEXT.statusHost(server.host_plays, server.fps, server.udp_ports, server.ice_servers.length));
  if (status.match) printWho();
}

export const statusCommand = Object.freeze({
  parent: SERVER_COMMAND.name,
  ownRun: true,
  usage: TEXT.server.usage,
  desc: TEXT.server.desc,
  help: { about: TEXT.server.about, examples: TEXT.server.examples, notes: TEXT.server.notes },
  run: (args: string[]): void => {
    if (args.length) throw new Error(TEXT.unknownSubcommand(args[0]));
    printStatus();
  },
});

export const statusSubcommand = Object.freeze({ parent: SERVER_COMMAND.name, name: COMMAND.name, aliases: COMMAND.aliases, ...TEXT.subcommand, run: printStatus });

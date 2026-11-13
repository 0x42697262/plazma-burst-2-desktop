import fs from 'node:fs';
import path from 'node:path';
import { FEATURE } from '#shared/features/keys.ts';
import type { ServerFeature, ServerFeatureContext } from '#server/feature-types.ts';
import type { MapSource } from '#server/maps.ts';
import { LOBBY_CLIENT, MAP_SOURCE_NAME, NEEDED_NAMES, OFFICIAL_LOBBY_URL, STRINGS_SCRIPT, TEXT_ENCODING, type NeededName } from './keys.ts';
import { TEXT } from './text.ts';
import { accountFileOf, readAccount } from './adapters/account.ts';
import { connectLobby, type LobbyNames } from './adapters/lobby-client.ts';
import { fetchMapFromLobby, pacedFetcher } from './services/fetch-map.ts';

const sleep = (ms: number): Promise<void> => new Promise((resolve) => { setTimeout(resolve, ms); });

function lobbyNamesOf(names: Readonly<Record<string, string>>): LobbyNames {
  const missing = NEEDED_NAMES.filter((key) => !names[key]);
  if (missing.length) throw new Error(TEXT.missingNames(missing));
  return Object.fromEntries(NEEDED_NAMES.map((key) => [key, names[key] ?? ''])) as Record<NeededName, string>;
}

export function lobbyMapSource(context: ServerFeatureContext, url: string = OFFICIAL_LOBBY_URL): MapSource {
  const account = readAccount(accountFileOf(context.dataDir));
  const names = lobbyNamesOf(context.names);
  const strings = fs.readFileSync(path.join(context.gameDir, STRINGS_SCRIPT), TEXT_ENCODING);
  if (!strings.includes(LOBBY_CLIENT.build)) context.log.warn(TEXT.buildChanged(LOBBY_CLIENT.build));
  context.log.info(TEXT.ready(account.login));
  let taskReported = false;
  const onTask = (): void => {
    if (taskReported) return;
    taskReported = true;
    context.log.warn(TEXT.taskIgnored);
  };
  const fetchOne = (id: string): Promise<string | null> => {
    context.log.info(TEXT.fetching(id));
    return fetchMapFromLobby(id, { connect: () => connectLobby({ gameDir: context.gameDir, names, url }), account, sleep, onTask });
  };
  return Object.freeze({ name: MAP_SOURCE_NAME, fetchMap: pacedFetcher(fetchOne, { clock: Date.now, sleep }) });
}

export const mapBotServer: ServerFeature = Object.freeze({
  id: FEATURE.mapBot,
  mapSources: (context: ServerFeatureContext) => ({ [MAP_SOURCE_NAME]: () => lobbyMapSource(context) }),
});

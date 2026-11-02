import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { FEATURE } from '#shared/features/keys.ts';
import { EDITION_DEFAULTS } from '#shared/editions/defaults.ts';
import type { WrapperDeps, WrapperFeature } from '#wrapper/feature-types.ts';
import { ID_ENCODING } from './keys.ts';
import { SERVER_ID_BYTES } from './constants.ts';
import { LAUNCHER_PAGE, LAUNCHER_PRELOAD, OLD_JOIN_FILE, SERVERS_FILE } from './paths.ts';
import { createServersStore } from './adapters/servers-file.ts';
import { createProbe } from './adapters/probe.ts';
import { createServerListService, type GameSession } from './services/server-list.ts';
import { serverListRoute } from './entry/route.ts';
import { registerServerListIpc, type IpcMainLike } from './entry/ipc.ts';

const newServerId = (): string => crypto.randomBytes(SERVER_ID_BYTES).toString(ID_ENCODING);
const readJsonIfThere = (file: string): unknown => (fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) as unknown : null);

export const LAUNCHER_URL = pathToFileURL(LAUNCHER_PAGE).href;
export { LAUNCHER_PAGE, LAUNCHER_PRELOAD };

export function createServerListWrapper(deps: WrapperDeps, session: GameSession) {
  const service = createServerListService({
    store: createServersStore(SERVERS_FILE, newServerId, (file) => fs.existsSync(file)),
    probe: createProbe(),
    session,
    gameVersion: deps.gameVersion || null,
    newId: newServerId,
    readOldJoin: () => readJsonIfThere(OLD_JOIN_FILE),
    defaultServers: EDITION_DEFAULTS.servers,
    info: (message) => deps.log.info(message),
    warn: (message) => deps.log.warn(message),
    later: (action) => { setTimeout(action, 0); },
    relativeServersFile: path.relative(deps.repoRoot, SERVERS_FILE),
  });
  const feature: WrapperFeature = Object.freeze({ id: FEATURE.serverList, routes: [serverListRoute(service)] });
  return {
    feature,
    service,
    registerIpc: (ipcMain: IpcMainLike) => registerServerListIpc(ipcMain, LAUNCHER_URL, service),
  };
}

export type ServerListWrapper = ReturnType<typeof createServerListWrapper>;

export const serverListPart = Object.freeze({
  create: createServerListWrapper,
  launcherPage: LAUNCHER_PAGE,
  launcherPreload: LAUNCHER_PRELOAD,
});

export type ServerListPart = typeof serverListPart;

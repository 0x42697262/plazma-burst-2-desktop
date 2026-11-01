import type { Logger } from '#kernel/log/logger.ts';
import { LOCAL_HOST_NAME, PUBLIC_BIND, REMOTE_PAGE_SCRIPT, SCALE_FACTOR_ONE, SCALE_FACTOR_SWITCH } from './keys.ts';
import { LOG, TEXT } from './text.ts';
import { isRefusedPageLoad } from './domain/game-page.ts';
import { createRemoteGames, type RemoteGameDeps } from './adapters/remote-games.ts';
import { CLIENT_DIST_DIR, TESTERS_FILE } from './paths.ts';
import { parseHostArgs, type HostOptions } from './domain/host-args.ts';
import { findTester, type Tester } from './adapters/testers-file.ts';
import { startHost, type Host, type RemoteGame } from './services/host.ts';

export type RemotePlayDeps = { log: Logger; args: readonly string[]; testersFile?: string; clientDir?: string };
export type CreateRemoteGame = (tester: Tester, options: HostOptions) => Promise<RemoteGame>;

export async function startRemotePlay({ log, args, testersFile = TESTERS_FILE, clientDir = CLIENT_DIST_DIR }: RemotePlayDeps, createGame: CreateRemoteGame): Promise<Host | null> {
  const { options, problems } = parseHostArgs(args);
  for (const problem of problems) log.warn(LOG.argProblem(problem));
  const host = startHost({
    ...options,
    clientDir,
    findTester: (token) => findTester(testersFile, token),
    createGame: (tester) => createGame(tester, options),
    log,
  });
  try {
    const port = await host.ready;
    const isPublic = options.bind === PUBLIC_BIND;
    log.info(LOG.listening(options.bind, port, options.width, options.height, options.fps, options.quality, options.maxGames));
    log.info(LOG.linkHint(LOG.localAddress(isPublic ? LOCAL_HOST_NAME : options.bind, port)));
    if (!isPublic) log.info(LOG.localOnly);
    return host;
  } catch (error) {
    log.error(LOG.cannotListen(options.bind, options.port, (error as Error).message));
    return null;
  }
}

export type RemotePlayStartDeps = RemoteGameDeps & { args: readonly string[] };

async function startRemotePlayHost({ log, args, startUrl, handleRequest, applyLogin }: RemotePlayStartDeps): Promise<boolean> {
  const games = createRemoteGames({ log, startUrl, handleRequest, applyLogin });
  return (await startRemotePlay({ log, args }, games.createRemoteGame)) !== null;
}

export const remotePlayPart = Object.freeze({
  pageScript: REMOTE_PAGE_SCRIPT,
  notMarked: LOG.notMarked,
  flagOff: LOG.flagOff,
  notAvailable: TEXT.notAvailable,
  scaleFactorSwitch: SCALE_FACTOR_SWITCH,
  scaleFactorOne: SCALE_FACTOR_ONE,
  refusesPageLoad: isRefusedPageLoad,
  start: startRemotePlayHost,
});

export type RemotePlayPart = typeof remotePlayPart;

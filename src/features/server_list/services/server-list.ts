import { OFFICIAL_ID, OFFICIAL_SERVER } from '../keys.ts';
import { OFFICIAL_DESCRIPTION, SERVICE_TEXT } from '../text.ts';
import { checkServer, passwordForSave, shownServer, type SaveRequest, type ServerEntry, type ShownServer } from '../domain/server.ts';
import { parseAddress } from '../domain/address.ts';
import type { ServerStatus } from '../domain/status.ts';
import type { ServersStore } from '../adapters/servers-file.ts';
import type { ServerProbe } from '../adapters/probe.ts';

export type GameSession = {
  startLoggedOut(): Promise<void>;
  applyCredentials(): Promise<void>;
  loadGame(): void;
  showList(): void;
  setTitle(title: string): void;
};

export type ServerListDeps = {
  store: ServersStore;
  probe: ServerProbe;
  session: GameSession;
  gameVersion: string | null;
  newId: () => string;
  readOldJoin: () => unknown;
  info: (message: string) => void;
  warn: (message: string) => void;
  later: (action: () => void) => void;
  relativeServersFile: string;
};

export type ServerCheck = { ping: number | null; status?: ServerStatus; error?: string; pinned?: boolean };

export type ServerListService = ReturnType<typeof createServerListService>;

const isNotPinned = (error: unknown): boolean => (error as { pinned?: boolean } | null)?.pinned === false;

export function createServerListService(deps: ServerListDeps) {
  const { store, probe, session } = deps;
  let joinTarget: ServerEntry | null = null;

  function list() {
    const { servers, last, problems } = store.load();
    for (const problem of problems) deps.warn(SERVICE_TEXT.serversFileProblem(problem));
    return { official: { ...OFFICIAL_SERVER, description: OFFICIAL_DESCRIPTION }, servers: servers.map(shownServer), last, gameVersion: deps.gameVersion, problems };
  }

  function save(request: SaveRequest | null | undefined): { errors: string[] } | { server: ShownServer } {
    const { servers, last } = store.load();
    const entry = request ?? {};
    const previous = typeof entry.id === 'string' ? servers.find((server) => server.id === entry.id) ?? null : null;
    if (typeof entry.id === 'string' && !previous) return { errors: [SERVICE_TEXT.notSaved] };
    const { password, dropped } = passwordForSave(previous, entry);
    const { server, errors } = checkServer({ ...entry, password }, deps.newId);
    if (!server) return { errors };
    const next = previous ? servers.map((existing) => (existing.id === previous.id ? server : existing)) : [...servers, server];
    store.save(next, last);
    if (dropped) deps.warn(SERVICE_TEXT.passwordDropped(server.name));
    return { server: shownServer(server) };
  }

  function remove(id: unknown): boolean {
    const { servers, last } = store.load();
    if (!servers.some((server) => server.id === id)) return false;
    store.save(servers.filter((server) => server.id !== id), last === id ? null : last);
    return true;
  }

  async function check(id: unknown): Promise<ServerCheck | { error: string }> {
    if (id === OFFICIAL_ID) return { ping: await probe.ping(OFFICIAL_SERVER.host, OFFICIAL_SERVER.port) };
    const server = store.load().servers.find((saved) => saved.id === id);
    if (!server) return { error: SERVICE_TEXT.notSavedShort };
    const [ping, status] = await Promise.all([
      probe.ping(server.host, server.port),
      probe.status(server).then((value) => ({ ok: true as const, value }), (error: unknown) => ({ ok: false as const, error })),
    ]);
    if (status.ok) return { ping, status: status.value };
    return { ping, error: (status.error as Error).message, pinned: !isNotPinned(status.error) };
  }

  async function fingerprint(address: unknown): Promise<string> {
    const parsed = parseAddress(address);
    return probe.fingerprint(parsed.host, parsed.port);
  }

  async function play(id: unknown): Promise<boolean> {
    const { servers } = store.load();
    const isOfficial = id === OFFICIAL_ID;
    const target = isOfficial ? null : servers.find((server) => server.id === id) ?? null;
    if (!isOfficial && !target) throw new Error(SERVICE_TEXT.notSaved);
    store.save(servers, typeof id === 'string' ? id : null);
    if (target) {
      await session.startLoggedOut();
      joinTarget = target;
      deps.info(SERVICE_TEXT.playing(target.name, target.hostPort, target.nickname));
      session.setTitle(SERVICE_TEXT.titlePrivate(target.name));
    } else {
      joinTarget = null;
      await session.applyCredentials();
      session.setTitle(SERVICE_TEXT.titleOfficial);
    }
    deps.later(() => session.loadGame());
    return true;
  }

  function showList(): void {
    joinTarget = null;
    session.setTitle(SERVICE_TEXT.titleOfficial);
    session.showList();
  }

  function openList(): boolean {
    deps.later(showList);
    return true;
  }

  function importOldJoinFile(): void {
    if (store.exists()) return;
    let old: unknown;
    try {
      old = deps.readOldJoin();
    } catch (error) {
      deps.warn(SERVICE_TEXT.importFailed((error as Error).message));
      return;
    }
    if (old === null) return;
    const { server } = checkServer(old, deps.newId);
    if (!server) return;
    store.save([server], null);
    deps.info(SERVICE_TEXT.imported(deps.relativeServersFile));
  }

  return {
    operations: { list, save, remove, check, fingerprint, play, openList },
    showList,
    importOldJoinFile,
    joinTarget: (): ServerEntry | null => joinTarget,
  };
}

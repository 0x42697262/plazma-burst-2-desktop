import path from 'node:path';
import { app, BrowserWindow, Menu, dialog, net, session, ipcMain, safeStorage, type MenuItemConstructorOptions } from 'electron';
import { CLIENTS, type GameClient } from '#kernel/config/clients.ts';
import { DATA_DIR, USER_ROOT } from '#kernel/config/paths.ts';
import { CLIENT, FEATURE, MODE, type ClientId } from '#shared/features/keys.ts';
import { TEXT as SADBURST_TEXT } from '#features/client_sadburst/text.ts';
import { createLogin } from '#features/login/wrapper.ts';
import { COOKIES_CHANGED } from '#features/login/keys.ts';
import { electronKeychain } from '#features/login/adapters/keychain.ts';
import { siteWindowOpener } from '#features/login/adapters/site-window.ts';
import { CAPABILITY } from '#shared/features/keys.ts';
import type { PinnedTarget } from '#features/cert_pinning/wrapper.ts';
import type { ServerListWrapper } from '#features/server_list/wrapper.ts';
import type { WrapperContext } from './context.ts';
import { WRAPPER_PARTS } from './features.ts';
import { isLauncherMode } from './mode.ts';
import { createClientRuntime, type ClientRuntime } from './client-runtime.ts';
import { MAIN_WINDOW } from './platform/constants.ts';
import { OFFICIAL_LOGIN_FILE } from './platform/keys.ts';
import { createSiteCookies } from './platform/site-cookies.ts';
import { readGameVersion } from './platform/game-files.ts';
import { oncePerKeyAtATime } from './platform/single-flight.ts';
import type { JoinPage } from './platform/index-page.ts';
import { MENU_ROLE, WINDOW_ALL_CLOSED } from './keys.ts';
import { APP_TEXT as TEXT } from './text.ts';

const clientById = (id: string): GameClient => {
  const client = (CLIENTS as Readonly<Record<string, GameClient | undefined>>)[id];
  if (!client) throw new Error(TEXT.unknownClient(id));
  return client;
};

export function startApp(context: WrapperContext): void {
  const { environment, log } = context;
  const isRemoteHost = environment.mode === MODE.remote;
  const isDedicatedHost = environment.mode === MODE.server;
  const launcherMode = isLauncherMode(context);
  const { serverListPart, gameSetupPart } = WRAPPER_PARTS;
  const chosen = clientById(environment.client);

  const login = createLogin({ log, dataDir: DATA_DIR, host: CLIENTS[CLIENT.official].host, fromEnvironment: environment.credentials, isOn: context.flags.login.on, keychain: electronKeychain(safeStorage),
    canUseAccounts: context.capabilities[CAPABILITY.login.accounts]?.on ?? false,
    canUseSite: context.capabilities[CAPABILITY.login.site]?.on ?? false,
    openSiteWindow: siteWindowOpener({ BrowserWindow, session, parent: () => gameWindow?.window ?? launcherWindow }),
    fetcher: (url, init) => net.fetch(url, { ...init, bypassCustomProtocolHandlers: true }),
    onOfficialSignOut: async () => {
      await siteCookies.forget();
      await login.applyQuietly(session.defaultSession.cookies);
      await refreshAllCookies();
    },
  });

  const cookieWatchers: (() => Promise<void>)[] = [];
  const refreshAllCookies = async (): Promise<void> => { for (const refresh of cookieWatchers) await refresh(); };
  let isWatchingCookies = false;
  const watchCookies = (refresh: () => Promise<void>): void => {
    cookieWatchers.push(refresh);
    if (isWatchingCookies) return;
    isWatchingCookies = true;
    session.defaultSession.cookies.on(COOKIES_CHANGED, () => { void refreshAllCookies(); });
  };

  const siteCookies = createSiteCookies(session.defaultSession.cookies, path.join(DATA_DIR, OFFICIAL_LOGIN_FILE));
  async function startLoggedOut(): Promise<void> {
    const hidden = await siteCookies.hideForPrivateServer();
    if (hidden.length) log.info(TEXT.loginHidden(hidden));
    await refreshAllCookies();
  }
  async function applyCredentials(): Promise<void> {
    if (login.hasCredentials()) {
      await siteCookies.forget();
      await login.applyCredentials(session.defaultSession.cookies);
      await refreshAllCookies();
      return;
    }
    const restored = await siteCookies.restoreOfficial();
    if (restored.length) log.info(TEXT.loginRestored(restored));
    await refreshAllCookies();
  }

  const runtimes = new Map<ClientId, ClientRuntime>();
  let launcherWindow: BrowserWindow | null = null;
  let gameWindow: { window: BrowserWindow; client: ClientId } | null = null;
  let lastClient: ClientId = chosen.id;
  const retired = new WeakSet<BrowserWindow>();
  let serverList: ServerListWrapper | null = null;
  const joinTarget = (): (JoinPage & PinnedTarget) | null => serverList?.service.joinTarget() ?? null;

  const availableClients = (): GameClient[] => Object.values(CLIENTS).filter((client) => client.feature === null || context.flagsFor(client.id).flags[client.feature].on);

  const runtimeFor = (id: ClientId): ClientRuntime => {
    const known = runtimes.get(id);
    if (known) return known;
    const made = createClientRuntime({ context, login, joinTarget, watchCookies, serverListFeature: (client) => serverList?.featureFor(client) ?? null }, CLIENTS[id]);
    runtimes.set(id, made);
    return made;
  };

  const prepareClient = oncePerKeyAtATime(prepareOnce);

  async function prepareOnce(id: string): Promise<void> {
    const client = clientById(id);
    const flags = context.flagsFor(client.id).flags;
    if (client.feature && !flags[client.feature].on) throw new Error(SADBURST_TEXT.flagOff(client.title, client.feature));
    if (runtimes.has(client.id)) return;
    const isOwnFolder = client.id === environment.client && environment.gameDir;
    if (gameSetupPart && flags.game_setup.on && !isOwnFolder) {
      const ready = await gameSetupPart.prepare({ client, gameDir: path.resolve(client.gameDir), checksForUpdates: app.isPackaged, log });
      if (!ready) throw new Error(TEXT.notPrepared(client.title));
    }
    const runtime = runtimeFor(client.id);
    if (runtime.isMissing()) {
      runtimes.delete(client.id);
      throw new Error(TEXT.gameMissing(runtime.root, client.runFlag));
    }
    await runtime.install();
  }

  function closeGameWindow(): void {
    if (!gameWindow) return;
    const { window } = gameWindow;
    gameWindow = null;
    retired.add(window);
    if (!window.isDestroyed()) window.destroy();
  }

  function openGame(id: string, title: string): void {
    const runtime = runtimes.get(id as ClientId);
    if (!runtime) return;
    const current = gameWindow;
    if (current && current.client === runtime.client.id && !current.window.isDestroyed()) {
      current.window.setTitle(title);
      void current.window.loadURL(runtime.startUrl);
      return;
    }
    closeGameWindow();
    const window = runtime.openWindow(title);
    gameWindow = { window, client: runtime.client.id };
    lastClient = runtime.client.id;
    window.on('closed', () => {
      if (retired.has(window)) return;
      gameWindow = null;
      app.quit();
    });
    launcherWindow?.hide();
    buildMenu();
  }

  function showLauncher(): void {
    if (!serverListPart) return;
    closeGameWindow();
    if (!launcherWindow || launcherWindow.isDestroyed()) {
      launcherWindow = new BrowserWindow({
        width: MAIN_WINDOW.width,
        height: MAIN_WINDOW.height,
        autoHideMenuBar: true,
        webPreferences: { backgroundThrottling: false, preload: serverListPart.launcherPreload },
      });
      launcherWindow.on('closed', () => { launcherWindow = null; app.quit(); });
    }
    void launcherWindow.loadFile(serverListPart.launcherPage);
    launcherWindow.show();
    launcherWindow.focus();
    buildMenu();
  }

  const clientVersion = (id: string): string | null => {
    const client = clientById(id);
    const isOwn = client.id === environment.client;
    return readGameVersion(path.resolve((isOwn && environment.gameDir) || client.gameDir), isOwn ? environment.gameVersion : null) || null;
  };

  serverList = serverListPart?.create(
    { log, isCapabilityOn: (id: string) => context.capabilities[id]?.on ?? false, gameVersion: '', client: chosen.id, repoRoot: USER_ROOT, gameDir: '', devKvFile: '', host: chosen.host },
    {
      clients: () => availableClients().map((client) => Object.freeze({ id: client.id, title: client.title, host: client.host })),
      prepare: prepareClient,
      open: openGame,
      startLoggedOut,
      applyCredentials,
      showList: showLauncher,
      accounts: login.accounts,
    },
    clientVersion,
  ) ?? null;

  function launchOwn(id: string): void {
    serverList?.playOwn(id).catch((error: unknown) => { dialog.showErrorBox(TEXT.cannotStart, (error as Error).message); });
  }

  function buildMenu(): void {
    const serversMenu: MenuItemConstructorOptions[] = launcherMode
      ? [{ label: TEXT.serversMenu, submenu: [{ label: TEXT.serverListItem, click: () => { serverList?.service.showList(); } }] }]
      : [];
    const choices = availableClients();
    const gameMenu: MenuItemConstructorOptions[] = launcherMode && choices.length > 1
      ? [{ label: TEXT.gameMenu, submenu: choices.map((choice) => ({ label: choice.title, type: 'radio' as const, checked: choice.id === lastClient, click: () => { if (choice.id !== gameWindow?.client) launchOwn(choice.id); } })) }]
      : [];
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { role: MENU_ROLE.file },
      ...gameMenu,
      ...serversMenu,
      { role: MENU_ROLE.edit },
      { role: MENU_ROLE.view },
      { label: TEXT.windowMenu, submenu: [{ role: MENU_ROLE.minimize }] },
    ]));
  }

  function refuseToStart(runtime: ClientRuntime): boolean {
    const { client, flags } = runtime;
    const { remotePlayPart, p2pHostPart } = WRAPPER_PARTS;
    if (client.feature && !flags[client.feature].on) log.error(SADBURST_TEXT.flagOff(client.title, client.feature));
    else if (runtime.isMissing()) {
      const message = TEXT.gameMissing(runtime.root, client.runFlag);
      log.error(message);
      dialog.showErrorBox(TEXT.gameMissingTitle(client.title), message);
    } else if (client.bundled && (isRemoteHost || isDedicatedHost)) log.error(TEXT.sadburstHostModes(client.title));
    else if (isRemoteHost && !flags.remote_play.on) log.error(remotePlayPart?.flagOff ?? TEXT.modeOff(FEATURE.remotePlay, flags.remote_play.reason));
    else if (isDedicatedHost && !flags.p2p_host.on) log.error(p2pHostPart?.flagOff ?? TEXT.modeOff(FEATURE.p2pHost, flags.p2p_host.reason));
    else return false;
    app.quit();
    return true;
  }

  async function onReady(): Promise<void> {
    if (chosen.feature && !context.flags[chosen.feature].on) {
      log.error(SADBURST_TEXT.flagOff(chosen.title, chosen.feature));
      app.quit();
      return;
    }
    if (launcherMode && serverList) {
      serverList.service.createFirstList();
      serverList.registerIpc(ipcMain);
      showLauncher();
      return;
    }
    const runtime = runtimeFor(chosen.id);
    if (refuseToStart(runtime)) return;
    if (isRemoteHost || isDedicatedHost) await applyCredentials();
    await runtime.install();
    buildMenu();
    if (isRemoteHost) {
      await runtime.startRemoteHost();
      return;
    }
    if (isDedicatedHost) {
      await runtime.startDedicatedHost();
      return;
    }
    openGame(chosen.id, chosen.title);
  }

  app.whenReady().then(onReady).catch((error: unknown) => { log.error((error as Error).stack ?? String(error)); });
  app.on(WINDOW_ALL_CLOSED, () => {
    if (!isRemoteHost) app.quit();
  });
}

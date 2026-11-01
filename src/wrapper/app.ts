import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { app, BrowserWindow, Menu, dialog, protocol, net, session, ipcMain, type MenuItemConstructorOptions, type Session } from 'electron';
import { CLIENTS } from '#kernel/config/clients.ts';
import { CONSOLE_BUNDLE_DIR, CONSOLE_BUNDLE_FILE, DATA_DIR, REPO_ROOT } from '#kernel/config/paths.ts';
import { CLIENT, MODE, PAGE_FLAGS_GLOBAL } from '#shared/features/keys.ts';
import { DEV_DIR, ROUTE_NAME } from '#shared/contract/keys.ts';
import { REMOTE_PAGE_SCRIPT, SCALE_FACTOR_ONE, SCALE_FACTOR_SWITCH } from '#features/remote_play/keys.ts';
import { TEXT as REMOTE_TEXT, LOG as REMOTE_LOG } from '#features/remote_play/text.ts';
import { isRefusedPageLoad } from '#features/remote_play/domain/game-page.ts';
import { startRemotePlay } from '#features/remote_play/wrapper.ts';
import { CONFIG_FILE_NAME, SETTINGS_FILE_NAME } from '#features/p2p_host/keys.ts';
import { HOST_LOG } from '#features/p2p_host/text.ts';
import { TEXT as SADBURST_TEXT } from '#features/client_sadburst/text.ts';
import { LAUNCHER_PAGE, LAUNCHER_PRELOAD } from '#features/server_list/wrapper.ts';
import { createLogin } from '#features/login/wrapper.ts';
import { pinCertificates, type PinnedTarget } from '#features/cert_pinning/wrapper.ts';
import type { WrapperContext } from './context.ts';
import { buildWrapper } from './features.ts';
import { createDevRouter, createInterceptor } from './http/router.ts';
import { MAIN_WINDOW, FORBIDDEN, UNAVAILABLE } from './platform/constants.ts';
import { FOLDER_END, HTML_TYPE, HTTPS_SCHEME, INDEX_FILE, NO_STORE, SCRIPT_TYPE, TEXT_ENCODING, callConsoleScript, moduleScriptTag, scriptTag } from './platform/keys.ts';
import { FILES_TEXT, PAGE_TEXT } from './platform/text.ts';
import { createKvFile } from './platform/kv-file.ts';
import { prepareIndex, pageGlobalScript, type JoinPage } from './platform/index-page.ts';
import { createGameFiles, readGameVersion, checkSadburstBuild } from './platform/game-files.ts';
import { createDevFiles, checkNamesFile, checkConsoleBundle } from './platform/dev-files.ts';
import { textResponse, typedResponse } from './platform/responses.ts';
import { logPage } from './platform/page-log.ts';
import { createRemoteGames } from './platform/remote-games.ts';
import { startDedicatedServer, type ServerPage } from './platform/dedicated-host.ts';
import type { PageContext } from './platform/context.ts';
import { CONSTRAINT_SOURCE, DEBUG_LEVEL, FETCH_DEST, FILE_ERROR_METHOD, HTTPS_PREFIX, MENU_ROLE, RELOAD_METHOD, WINDOW_ALL_CLOSED } from './keys.ts';
import { APP_TEXT as TEXT } from './text.ts';

const ignore = (): void => undefined;

export function startApp({ environment, flags, log }: WrapperContext): void {
  const client = CLIENTS[environment.client];
  const isSadburst = client.id === CLIENT.sadburst;
  const isRemoteHost = environment.mode === MODE.remote;
  const isDedicatedHost = environment.mode === MODE.server;
  if (isRemoteHost) app.commandLine.appendSwitch(SCALE_FACTOR_SWITCH, SCALE_FACTOR_ONE);

  const root = path.resolve(environment.gameDir || client.gameDir);
  const host = client.host;
  const version = readGameVersion(root, environment.gameVersion);
  const prefix = client.gamePrefix(version);
  const startUrl = HTTPS_PREFIX + host + prefix;
  const devPrefix = prefix + DEV_DIR;
  const hooksOn = flags.hooks.on;
  const devConsoleOn = flags.dev_console.on;
  const devSettingsFile = path.join(DATA_DIR, client.settingsFileName);
  const serverSettingsFile = path.join(DATA_DIR, SETTINGS_FILE_NAME);

  let mainWindow: BrowserWindow | null = null;
  let serverPage: ServerPage | null = null;
  const liveWindow = (): BrowserWindow | null => (mainWindow && !mainWindow.isDestroyed() ? mainWindow : null);
  const gameSession = (): Session => (client.partition ? session.fromPartition(client.partition) : session.defaultSession);

  const login = createLogin({ log, dataDir: DATA_DIR, host, fromEnvironment: environment.credentials, isOn: flags.login.on });
  const startLoggedOut = (): Promise<void> => login.startLoggedOut(session.defaultSession.cookies);
  const applyCredentials = (): Promise<void> => login.applyCredentials(session.defaultSession.cookies);

  const wrapper = buildWrapper(
    { log, gameVersion: version || '', isSadburst, repoRoot: REPO_ROOT, gameDir: root, devKvFile: devSettingsFile, host },
    {
      hooks: { namesFile: client.names, gamePrefix: prefix },
      gameSession: {
        startLoggedOut,
        applyCredentials,
        loadGame: () => { void liveWindow()?.loadURL(startUrl); },
        showList: () => { void liveWindow()?.loadFile(LAUNCHER_PAGE); },
        setTitle: (title) => { liveWindow()?.setTitle(title); },
      },
    },
  );
  const serverList = wrapper.serverList;
  const joinTarget = (): (JoinPage & PinnedTarget) | null => serverList.service.joinTarget();
  const isOn = (id: keyof typeof flags): boolean => flags[id].on;
  const intercept = createInterceptor(wrapper.features, isOn);
  const serveDev = createDevFiles({
    consoleDir: CONSOLE_BUNDLE_DIR,
    consoleEntry: CONSOLE_BUNDLE_FILE,
    namesFile: client.names,
    opcodesFile: client.opcodes,
    router: createDevRouter(wrapper.features, isOn),
  });
  const gameFiles = createGameFiles({ root, log, keepMissing: isSadburst });

  const callConsole = (method: string, argument: unknown): void => {
    mainWindow?.webContents.executeJavaScript(callConsoleScript(method, argument)).catch(ignore);
  };
  const settingsEvents = {
    onChange: (saved: unknown) => { callConsole(RELOAD_METHOD, saved); },
    onError: (message: string) => { callConsole(FILE_ERROR_METHOD, message); },
  };
  const devSettings = createKvFile(devSettingsFile, settingsEvents);
  const serverSettings = createKvFile(serverSettingsFile, settingsEvents);

  const devScripts = pageGlobalScript(PAGE_FLAGS_GLOBAL, flags)
    + scriptTag(DEV_DIR + ROUTE_NAME.names)
    + scriptTag(DEV_DIR + ROUTE_NAME.opcodes)
    + moduleScriptTag(DEV_DIR + ROUTE_NAME.console + CONSOLE_BUNDLE_FILE);

  const localContext: PageContext = {
    remote: false,
    name: '',
    fetch: (request) => (isSadburst ? gameSession().fetch(request, { bypassCustomProtocolHandlers: true }) : net.fetch(request, { bypassCustomProtocolHandlers: true })),
    kvFile: devSettings,
    get window() { return mainWindow; },
  };
  const serverContext: PageContext = {
    remote: false,
    server: true,
    name: '',
    fetch: (request) => net.fetch(request, { bypassCustomProtocolHandlers: true }),
    kvFile: serverSettings,
    get window() { return mainWindow; },
  };

  async function serveIndex(context: PageContext): Promise<Response> {
    const html = await fs.readFile(path.join(root, INDEX_FILE), TEXT_ENCODING);
    const prepared = prepareIndex(html, {
      hooks: hooksOn ? wrapper.hooks.injectIndex : null,
      devScripts: devConsoleOn ? devScripts : null,
      join: joinTarget(),
      serverPage,
      remoteScript: context.remote ? REMOTE_PAGE_SCRIPT : null,
      remoteNotMarked: REMOTE_LOG.notMarked,
      verbose: log.on(DEBUG_LEVEL) && !isSadburst,
      isServer: !!context.server,
    });
    for (const error of prepared.errors) log.error(error);
    for (const warning of prepared.warnings) log.warn(warning);
    return prepared.html === null ? textResponse(FILES_TEXT.notAvailable, UNAVAILABLE) : typedResponse(prepared.html, HTML_TYPE);
  }

  async function serveLocal(url: URL, context: PageContext): Promise<Response> {
    let relative = decodeURIComponent(url.pathname.slice(prefix.length));
    if (relative === '' || relative.endsWith(FOLDER_END)) relative += INDEX_FILE;
    const preparesIndex = devConsoleOn || hooksOn || context.remote || !!context.server || !!joinTarget();
    if (preparesIndex && relative === INDEX_FILE) return serveIndex(context);
    const hooked = hooksOn ? wrapper.hooks.changedScript(relative) : null;
    if (hooked !== null) return typedResponse(hooked, SCRIPT_TYPE, false);
    return gameFiles.serveFile(relative, url, context.fetch);
  }

  async function handleRequest(request: Request, context: PageContext): Promise<Response> {
    const url = new URL(request.url);
    if (context.remote && isRefusedPageLoad(request.headers.get(FETCH_DEST), request.url, startUrl)) return textResponse(REMOTE_TEXT.notAvailable, FORBIDDEN);
    const intercepted = await intercept(request, url, context);
    if (intercepted) return intercepted;
    if (url.hostname === host && url.pathname.startsWith(prefix)) {
      if (devConsoleOn && url.pathname.startsWith(devPrefix)) return serveDev(decodeURIComponent(url.pathname.slice(devPrefix.length)), request, url, context);
      return serveLocal(url, context);
    }
    return context.fetch(request);
  }

  async function handleRequestLogged(request: Request, context: PageContext): Promise<Response> {
    if (!log.on(DEBUG_LEVEL)) return handleRequest(request, context);
    const started = Date.now();
    const response = await handleRequest(request, context);
    log.debug(PAGE_TEXT.request(context.name, request.method, request.url, response.status, Date.now() - started));
    return response;
  }

  const remoteGames = createRemoteGames({ log, startUrl, handleRequest: handleRequestLogged, applyLogin: (cookies) => login.applyQuietly(cookies) });

  async function startRemoteHost(): Promise<void> {
    const remoteHost = await startRemotePlay({ log, args: environment.args }, remoteGames.createRemoteGame);
    if (!remoteHost) app.quit();
  }

  function refuseToStart(): boolean {
    const isMissingGame = !version || !fsSync.existsSync(path.join(root, INDEX_FILE));
    if (isSadburst && !flags.client_sadburst.on) log.error(SADBURST_TEXT.flagOff);
    else if (isMissingGame) {
      const message = TEXT.gameMissing(root, client.runFlag);
      log.error(message);
      dialog.showErrorBox(TEXT.gameMissingTitle(client.title), message);
    } else if (isSadburst && (isRemoteHost || isDedicatedHost)) log.error(TEXT.sadburstHostModes);
    else if (isRemoteHost && !flags.remote_play.on) log.error(REMOTE_LOG.flagOff);
    else if (isDedicatedHost && !flags.p2p_host.on) log.error(HOST_LOG.flagOff);
    else return false;
    app.quit();
    return true;
  }

  function buildMenu(): void {
    const showsServerList = !isRemoteHost && !isDedicatedHost && flags.server_list.on;
    const serversMenu: MenuItemConstructorOptions[] = showsServerList
      ? [{ label: TEXT.serversMenu, submenu: [{ label: TEXT.serverListItem, click: () => { serverList.service.showList(); } }] }]
      : [];
    Menu.setApplicationMenu(Menu.buildFromTemplate([
      { role: MENU_ROLE.file },
      ...serversMenu,
      { role: MENU_ROLE.edit },
      { role: MENU_ROLE.view },
      { label: TEXT.windowMenu, submenu: [{ role: MENU_ROLE.minimize }] },
    ]));
  }

  function openMainWindow(): void {
    const window = new BrowserWindow({
      width: MAIN_WINDOW.width,
      height: MAIN_WINDOW.height,
      autoHideMenuBar: true,
      title: client.title,
      webPreferences: isSadburst
        ? { backgroundThrottling: false, partition: client.partition ?? undefined }
        : { backgroundThrottling: false, preload: LAUNCHER_PRELOAD },
    });
    mainWindow = window;
    logPage(window, '', log);
    if (devConsoleOn) {
      try {
        devSettings.watch();
      } catch (error) {
        log.warn(TEXT.notWatching(devSettingsFile, (error as Error).message));
      }
    }
    if (!flags.server_list.on) {
      void window.loadURL(startUrl);
      return;
    }
    serverList.service.importOldJoinFile();
    serverList.registerIpc(ipcMain);
    serverList.service.showList();
  }

  async function onReady(): Promise<void> {
    if (refuseToStart()) return;
    log.info(TEXT.gameFrom(isSadburst ? TEXT.clientPrefix(client.title) : '', version ?? '', root));
    if (isSadburst) {
      if (flags.hooks.source === CONSTRAINT_SOURCE) log.info(TEXT.sadburstHooksOff);
      void checkSadburstBuild({ root, site: client.site, prefix, log, fetchLive: (url) => net.fetch(url, { bypassCustomProtocolHandlers: true, cache: NO_STORE }) });
    }
    log.debug(TEXT.debugLevel);
    if (devConsoleOn) {
      checkNamesFile({ namesFile: client.names, repoRoot: REPO_ROOT, gameVersion: version, runFlag: client.runFlag, log });
      checkConsoleBundle({ consoleDir: CONSOLE_BUNDLE_DIR, consoleEntry: CONSOLE_BUNDLE_FILE, log });
    }
    if (isRemoteHost || isDedicatedHost) await applyCredentials();
    else if (flags.cert_pinning.on) pinCertificates(session.defaultSession, joinTarget, log);

    const pageContext = isDedicatedHost ? serverContext : localContext;
    const handler = (request: Request): Promise<Response> => handleRequestLogged(request, pageContext);
    if (isSadburst) gameSession().protocol.handle(HTTPS_SCHEME, handler);
    else protocol.handle(HTTPS_SCHEME, handler);
    buildMenu();

    if (isRemoteHost) {
      await startRemoteHost();
      return;
    }
    if (isDedicatedHost) {
      await startDedicatedServer({
        log,
        args: environment.args,
        defaultConfigFile: path.join(DATA_DIR, CONFIG_FILE_NAME),
        devConsoleOn,
        namesFile: client.names,
        settingsFile: serverSettingsFile,
        settings: serverSettings,
        startUrl,
        findLocalMap: (name) => wrapper.mapCache.findLocalMap(name),
        mapsDir: wrapper.mapCache.mapsDir,
        setServerPage: (page) => { serverPage = page; },
        setWindow: (window) => { mainWindow = window; },
        quit: () => { app.quit(); },
        exit: () => { app.exit(0); },
      });
      return;
    }
    openMainWindow();
  }

  app.whenReady().then(onReady).catch((error: unknown) => { log.error((error as Error).stack ?? String(error)); });
  app.on(WINDOW_ALL_CLOSED, () => {
    if (!isRemoteHost) app.quit();
  });
}

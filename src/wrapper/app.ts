import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { app, BrowserWindow, Menu, dialog, protocol, net, session, ipcMain, safeStorage, type MenuItemConstructorOptions, type Session } from 'electron';
import { CLIENTS } from '#kernel/config/clients.ts';
import { CONSOLE_BUNDLE_FILE, DATA_DIR, PAGE_BUNDLE_DIR, PAGE_CORE_FILE, USER_ROOT } from '#kernel/config/paths.ts';
import { CAPABILITY, CLIENT, FEATURE, MODE, PAGE_CAPABILITIES_GLOBAL, PAGE_FLAGS_GLOBAL } from '#shared/features/keys.ts';
import { DEV_DIR, ROUTE_NAME } from '#shared/contract/keys.ts';
import { TEXT as SADBURST_TEXT } from '#features/client_sadburst/text.ts';
import { createLogin } from '#features/login/wrapper.ts';
import { COOKIES_CHANGED, COOKIE_NAME, SITE } from '#features/login/keys.ts';
import { electronKeychain } from '#features/login/adapters/keychain.ts';
import { siteWindowOpener } from '#features/login/adapters/site-window.ts';
import { pinCertificates, type PinnedTarget } from '#features/cert_pinning/wrapper.ts';
import type { ServerPage } from '#features/p2p_host/wrapper.ts';
import type { WrapperContext } from './context.ts';
import { WRAPPER_PARTS } from './features.ts';
import { buildWrapper } from './build-wrapper.ts';
import { createDevRouter, createInterceptor } from './http/router.ts';
import { MAIN_WINDOW, FORBIDDEN, UNAVAILABLE } from './platform/constants.ts';
import { FOLDER_END, HTML_TYPE, HTTPS_SCHEME, INDEX_FILE, NO_STORE, OFFICIAL_LOGIN_FILE, SCRIPT_TYPE, TEXT_ENCODING, callConsoleScript, moduleScriptTag, scriptTag } from './platform/keys.ts';
import { FILES_TEXT, PAGE_TEXT } from './platform/text.ts';
import { createKvFile, seedKvFile } from './platform/kv-file.ts';
import { EDITION_DEFAULTS } from '#shared/editions/defaults.ts';
import { EDITION } from '#shared/editions/constants.ts';
import { isHiddenFeature } from '#shared/editions/hidden.ts';
import { createSiteCookies } from './platform/site-cookies.ts';
import { relaunchAs } from './platform/relaunch.ts';
import { prepareIndex, pageGlobalScript, type JoinPage } from './platform/index-page.ts';
import { createGameFiles, readGameVersion, checkSadburstBuild } from './platform/game-files.ts';
import { createDevFiles, checkNamesFile, checkPageBundle } from './platform/dev-files.ts';
import { textResponse, typedResponse } from './platform/responses.ts';
import { logPage } from './platform/page-log.ts';
import type { PageContext } from './platform/context.ts';
import { CONSTRAINT_SOURCE, DEBUG_LEVEL, FETCH_DEST, FILE_ERROR_METHOD, HTTPS_PREFIX, MENU_ROLE, RELOAD_METHOD, RENDER_PROCESS_GONE, WINDOW_ALL_CLOSED } from './keys.ts';
import { APP_TEXT as TEXT } from './text.ts';

const ignore = (): void => undefined;

export function startApp({ environment, flags, capabilities, log }: WrapperContext): void {
  const client = CLIENTS[environment.client];
  const isSadburst = client.id === CLIENT.sadburst;
  const isRemoteHost = environment.mode === MODE.remote;
  const isDedicatedHost = environment.mode === MODE.server;
  const { remotePlayPart, p2pHostPart, serverListPart } = WRAPPER_PARTS;

  const root = path.resolve(environment.gameDir || client.gameDir);
  const host = client.host;
  const version = readGameVersion(root, environment.gameVersion);
  const prefix = client.gamePrefix(version);
  const startUrl = HTTPS_PREFIX + host + prefix;
  const devPrefix = prefix + DEV_DIR;
  const hooksOn = flags.hooks.on;
  const devConsoleOn = flags.dev_console.on;
  const hasPageCoreFeature = flags.lobby_task_guard.on || flags.server_list.on;
  const pageCoreOn = devConsoleOn || hasPageCoreFeature;
  const devSettingsFile = path.join(DATA_DIR, client.settingsFileName);
  const serverSettingsFile = p2pHostPart ? path.join(DATA_DIR, p2pHostPart.settingsFileName) : null;

  let mainWindow: BrowserWindow | null = null;
  let serverPage: ServerPage | null = null;
  const liveWindow = (): BrowserWindow | null => (mainWindow && !mainWindow.isDestroyed() ? mainWindow : null);
  const gameSession = (): Session => (client.partition ? session.fromPartition(client.partition) : session.defaultSession);

  const otherClients = Object.values(CLIENTS)
    .filter((other) => other.id !== client.id && (other.id !== CLIENT.sadburst || flags.client_sadburst.on))
    .map((other) => Object.freeze({ id: other.id, title: other.title, host: other.host }));
  const switchClient = (id: string): void => {
    const chosen = Object.values(CLIENTS).find((other) => other.id === id);
    if (chosen) relaunchAs(chosen.id);
  };

  const login = createLogin({ log, dataDir: DATA_DIR, host, fromEnvironment: environment.credentials, isOn: flags.login.on, keychain: electronKeychain(safeStorage),
    canUseAccounts: capabilities[CAPABILITY.login.accounts]?.on ?? false,
    canUseSite: capabilities[CAPABILITY.login.site]?.on ?? false,
    openSiteWindow: siteWindowOpener({ BrowserWindow, session, parent: () => liveWindow() }),
    fetcher: (url, init) => net.fetch(url, { ...init, bypassCustomProtocolHandlers: true }),
    onOfficialSignOut: async () => {
      await siteCookies.forget();
      await login.applyQuietly(session.defaultSession.cookies);
    },
  });
  let sessionCookies: { login: string | null; password: string | null; pb2uid: string | null } = { login: null, password: null, pb2uid: null };
  async function refreshSessionCookies(): Promise<void> {
    if (!flags.login.on || isSadburst) {
      sessionCookies = { login: null, password: null, pb2uid: null };
      return;
    }
    const cookies = await session.defaultSession.cookies.get({ domain: SITE }).catch(() => []);
    const byName = new Map(cookies.map((cookie) => [cookie.name, cookie.value || null]));
    sessionCookies = {
      login: byName.get(COOKIE_NAME.login) ?? null,
      password: byName.get(COOKIE_NAME.password) ?? null,
      pb2uid: byName.get(COOKIE_NAME.pb2uid) ?? null
    };
  }
  const siteCookies = createSiteCookies(session.defaultSession.cookies, path.join(DATA_DIR, OFFICIAL_LOGIN_FILE));
  async function startLoggedOut(): Promise<void> {
    const hidden = await siteCookies.hideForPrivateServer();
    if (hidden.length) log.info(TEXT.loginHidden(hidden));
    await refreshSessionCookies();
  }
  async function applyCredentials(): Promise<void> {
    if (login.hasCredentials()) {
      await siteCookies.forget();
      await login.applyCredentials(session.defaultSession.cookies);
      await refreshSessionCookies();
      return;
    }
    const restored = await siteCookies.restoreOfficial();
    if (restored.length) log.info(TEXT.loginRestored(restored));
    await refreshSessionCookies();
  }

  const wrapper = buildWrapper(
    WRAPPER_PARTS,
    { log, isCapabilityOn: (id: string) => capabilities[id]?.on ?? false, gameVersion: version || '', isSadburst, repoRoot: USER_ROOT, gameDir: root, devKvFile: devSettingsFile, host },
    {
      hooks: { namesFile: client.names, gamePrefix: prefix },
      gameSession: {
        startLoggedOut,
        applyCredentials,
        loadGame: () => { void liveWindow()?.loadURL(startUrl); },
        showList: () => { if (serverListPart) void liveWindow()?.loadFile(serverListPart.launcherPage); },
        setTitle: (title) => { liveWindow()?.setTitle(title); },
        otherClients: () => otherClients,
        switchClient,
        accounts: login.accounts,
      },
      diagnostics: {
        client: client.id,
        appVersion: app.getVersion(),
        flags,
        capabilities,
        login: () => login.identity(client.id).login ?? sessionCookies.login,
        cookies: () => {
          const current = login.identity(client.id).cookies;
          return {
            login: current.login ?? sessionCookies.login,
            password: current.password ?? sessionCookies.password,
            pb2uid: current.pb2uid ?? sessionCookies.pb2uid
          };
        },
        urlFromEnvironment: environment.diagnosticsUrl,
        fetch: (url, init) => net.fetch(url, { ...init, bypassCustomProtocolHandlers: true }),
        onRendererGone: (listener) => { app.on(RENDER_PROCESS_GONE, (_event, _contents, details) => { listener(details.reason, details.exitCode); }); },
      },
    },
  );
  const serverList = wrapper.serverList;
  const joinTarget = (): (JoinPage & PinnedTarget) | null => serverList?.service.joinTarget() ?? null;
  const isOn = (id: keyof typeof flags): boolean => flags[id].on;
  const intercept = createInterceptor(wrapper.features, isOn);
  const serveDev = createDevFiles({
    pageDir: PAGE_BUNDLE_DIR,
    namesFile: client.names,
    opcodesFile: client.opcodes,
    consoleOn: devConsoleOn,
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
  const serverSettings = serverSettingsFile ? createKvFile(serverSettingsFile, settingsEvents) : null;

  const pageCoreScripts = pageGlobalScript(PAGE_FLAGS_GLOBAL, flags)
    + pageGlobalScript(PAGE_CAPABILITIES_GLOBAL, capabilities)
    + scriptTag(DEV_DIR + ROUTE_NAME.names)
    + moduleScriptTag(DEV_DIR + ROUTE_NAME.page + PAGE_CORE_FILE);
  const consoleScripts = scriptTag(DEV_DIR + ROUTE_NAME.opcodes)
    + moduleScriptTag(DEV_DIR + ROUTE_NAME.page + CONSOLE_BUNDLE_FILE);
  const pageScripts = pageCoreOn ? pageCoreScripts + (devConsoleOn ? consoleScripts : '') : null;

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
      hooks: hooksOn && wrapper.hooks ? wrapper.hooks.injectIndex : null,
      pageScripts,
      join: joinTarget(),
      serverPage,
      remoteScript: context.remote ? remotePlayPart?.pageScript ?? null : null,
      remoteNotMarked: remotePlayPart?.notMarked ?? '',
      verbose: log.on(DEBUG_LEVEL) && !isSadburst,
      isServer: !!context.server,
      accountScript: isSadburst ? login.sadburstStartupScript() : null,
    });
    for (const error of prepared.errors) log.error(error);
    for (const warning of prepared.warnings) log.warn(warning);
    return prepared.html === null ? textResponse(FILES_TEXT.notAvailable, UNAVAILABLE) : typedResponse(prepared.html, HTML_TYPE);
  }

  async function serveLocal(url: URL, context: PageContext): Promise<Response> {
    let relative = decodeURIComponent(url.pathname.slice(prefix.length));
    if (relative === '' || relative.endsWith(FOLDER_END)) relative += INDEX_FILE;
    const preparesIndex = pageCoreOn || hooksOn || context.remote || !!context.server || !!joinTarget() || (isSadburst && flags.login.on);
    if (preparesIndex && relative === INDEX_FILE) return serveIndex(context);
    const hooked = hooksOn && wrapper.hooks ? wrapper.hooks.changedScript(relative) : null;
    if (hooked !== null) return typedResponse(hooked, SCRIPT_TYPE, false);
    return gameFiles.serveFile(relative, url, context.fetch);
  }

  async function handleRequest(request: Request, context: PageContext): Promise<Response> {
    const url = new URL(request.url);
    if (context.remote && remotePlayPart?.refusesPageLoad(request.headers.get(FETCH_DEST), request.url, startUrl)) return textResponse(remotePlayPart.notAvailable, FORBIDDEN);
    const intercepted = await intercept(request, url, context);
    if (intercepted) return intercepted;
    if (url.hostname === host && url.pathname.startsWith(prefix)) {
      if (pageCoreOn && url.pathname.startsWith(devPrefix)) return serveDev(decodeURIComponent(url.pathname.slice(devPrefix.length)), request, url, context);
      return serveLocal(url, context);
    }
    return context.fetch(request);
  }

  const quietRoute = isHiddenFeature(EDITION, FEATURE.diagnostics) ? devPrefix + ROUTE_NAME.diagnostics : null;

  async function handleRequestLogged(request: Request, context: PageContext): Promise<Response> {
    const isQuiet = quietRoute !== null && new URL(request.url).pathname.startsWith(quietRoute);
    if (isQuiet || !log.on(DEBUG_LEVEL)) return handleRequest(request, context);
    const started = Date.now();
    const response = await handleRequest(request, context);
    log.debug(PAGE_TEXT.request(context.name, request.method, request.url, response.status, Date.now() - started));
    return response;
  }

  async function startRemoteHost(): Promise<void> {
    const started = await remotePlayPart?.start({ log, args: environment.args, startUrl, handleRequest: handleRequestLogged, applyLogin: (cookies) => login.applyQuietly(cookies) });
    if (!started) app.quit();
  }

  function refuseToStart(): boolean {
    const isMissingGame = !version || !fsSync.existsSync(path.join(root, INDEX_FILE));
    if (isSadburst && !flags.client_sadburst.on) log.error(SADBURST_TEXT.flagOff);
    else if (isMissingGame) {
      const message = TEXT.gameMissing(root, client.runFlag);
      log.error(message);
      dialog.showErrorBox(TEXT.gameMissingTitle(client.title), message);
    } else if (isSadburst && (isRemoteHost || isDedicatedHost)) log.error(TEXT.sadburstHostModes);
    else if (isRemoteHost && !flags.remote_play.on) log.error(remotePlayPart?.flagOff ?? TEXT.modeOff(FEATURE.remotePlay, flags.remote_play.reason));
    else if (isDedicatedHost && !flags.p2p_host.on) log.error(p2pHostPart?.flagOff ?? TEXT.modeOff(FEATURE.p2pHost, flags.p2p_host.reason));
    else return false;
    app.quit();
    return true;
  }

  function buildMenu(): void {
    const showsServerList = !isRemoteHost && !isDedicatedHost && flags.server_list.on && serverList !== null;
    const serversMenu: MenuItemConstructorOptions[] = showsServerList
      ? [{ label: TEXT.serversMenu, submenu: [{ label: TEXT.serverListItem, click: () => { serverList?.service.showList(); } }] }]
      : [];
    const playsAGame = !isRemoteHost && !isDedicatedHost;
    const gameMenu: MenuItemConstructorOptions[] = playsAGame && otherClients.length
      ? [{ label: TEXT.gameMenu, submenu: [client, ...otherClients].map((choice) => ({ label: choice.title, type: 'radio' as const, checked: choice.id === client.id, click: () => { if (choice.id !== client.id) switchClient(choice.id); } })) }]
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

  function openMainWindow(): void {
    const window = new BrowserWindow({
      width: MAIN_WINDOW.width,
      height: MAIN_WINDOW.height,
      autoHideMenuBar: true,
      title: client.title,
      webPreferences: isSadburst
        ? { backgroundThrottling: false, partition: client.partition ?? undefined }
        : { backgroundThrottling: false, preload: serverListPart?.launcherPreload },
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
    if (!flags.server_list.on || !serverList) {
      void window.loadURL(startUrl);
      return;
    }
    serverList.service.createFirstList();
    serverList.registerIpc(ipcMain);
    serverList.service.showList();
  }

  async function onReady(): Promise<void> {
    if (refuseToStart()) return;
    if (devConsoleOn && seedKvFile(devSettingsFile, EDITION_DEFAULTS.settings)) log.info(TEXT.settingsSeeded(path.relative(USER_ROOT, devSettingsFile)));
    log.info(TEXT.gameFrom(isSadburst ? TEXT.clientPrefix(client.title) : '', version ?? '', root));
    if (isSadburst) {
      if (flags.hooks.source === CONSTRAINT_SOURCE) log.info(TEXT.sadburstHooksOff);
      void checkSadburstBuild({ root, site: client.site, prefix, log, fetchLive: (url) => net.fetch(url, { bypassCustomProtocolHandlers: true, cache: NO_STORE }) });
    }
    log.debug(TEXT.debugLevel);
    if (pageCoreOn) {
      checkNamesFile({ namesFile: client.names, repoRoot: USER_ROOT, gameVersion: version, runFlag: client.runFlag, log });
      checkPageBundle({ pageDir: PAGE_BUNDLE_DIR, entries: devConsoleOn ? [PAGE_CORE_FILE, CONSOLE_BUNDLE_FILE] : [PAGE_CORE_FILE], log });
    }
    if (isRemoteHost || isDedicatedHost) await applyCredentials();
    else if (flags.cert_pinning.on) pinCertificates(session.defaultSession, joinTarget, log);
    await refreshSessionCookies();
    session.defaultSession.cookies.on(COOKIES_CHANGED, () => { void refreshSessionCookies(); });

    const pageContext = isDedicatedHost ? serverContext : localContext;
    const handler = (request: Request): Promise<Response> => handleRequestLogged(request, pageContext);
    if (isSadburst) gameSession().protocol.handle(HTTPS_SCHEME, handler);
    else protocol.handle(HTTPS_SCHEME, handler);
    buildMenu();

    if (isRemoteHost) {
      await startRemoteHost();
      return;
    }
    if (isDedicatedHost && p2pHostPart && serverSettingsFile && serverSettings) {
      const mapCache = wrapper.mapCache;
      await p2pHostPart.start({
        log,
        args: environment.args,
        defaultConfigFile: path.join(DATA_DIR, p2pHostPart.configFileName),
        devConsoleOn,
        namesFile: client.names,
        settingsFile: serverSettingsFile,
        settings: serverSettings,
        startUrl,
        findLocalMap: (name) => mapCache?.findLocalMap(name) ?? Promise.resolve(null),
        mapsDir: mapCache?.mapsDir ?? '',
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

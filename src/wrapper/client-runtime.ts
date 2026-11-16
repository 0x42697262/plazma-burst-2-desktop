import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { app, BrowserWindow, net, protocol, session, type Session } from 'electron';
import type { GameClient } from '#kernel/config/clients.ts';
import { CONSOLE_BUNDLE_FILE, DATA_DIR, PAGE_BUNDLE_DIR, PAGE_CORE_FILE, USER_ROOT } from '#kernel/config/paths.ts';
import { CLIENT, FEATURE, MODE, PAGE_CAPABILITIES_GLOBAL, PAGE_FLAGS_GLOBAL } from '#shared/features/keys.ts';
import { DEV_DIR, ROUTE_NAME } from '#shared/contract/keys.ts';
import { createLogin } from '#features/login/wrapper.ts';
import { COOKIE_NAME, siteCookiesIn } from '#features/login/keys.ts';
import { pinCertificates, type PinnedTarget } from '#features/cert_pinning/wrapper.ts';
import type { ServerPage } from '#features/p2p_host/wrapper.ts';
import type { WrapperContext } from './context.ts';
import type { WrapperFeature } from './feature-types.ts';
import { WRAPPER_PARTS } from './features.ts';
import { buildWrapper } from './build-wrapper.ts';
import { createDevRouter, createInterceptor } from './http/router.ts';
import { MAIN_WINDOW, FORBIDDEN, UNAVAILABLE } from './platform/constants.ts';
import { FOLDER_END, HTML_TYPE, HTTPS_SCHEME, INDEX_FILE, NO_STORE, SCRIPT_TYPE, TEXT_ENCODING, callConsoleScript, moduleScriptTag, scriptTag } from './platform/keys.ts';
import { FILES_TEXT, PAGE_TEXT } from './platform/text.ts';
import { createKvFile, seedKvFile } from './platform/kv-file.ts';
import { EDITION_DEFAULTS } from '#shared/editions/defaults.ts';
import { EDITION } from '#shared/editions/constants.ts';
import { isHiddenFeature } from '#shared/editions/hidden.ts';
import { prepareIndex, pageGlobalScript, type JoinPage } from './platform/index-page.ts';
import { createGameFiles, readGameVersion, checkSadburstBuild } from './platform/game-files.ts';
import { createDevFiles, checkNamesFile, checkPageBundle } from './platform/dev-files.ts';
import { textResponse, typedResponse } from './platform/responses.ts';
import { onceUntilItFails } from './platform/single-flight.ts';
import type { CrashPorts } from './platform/crash-hub.ts';
import { logPage } from './platform/page-log.ts';
import type { PageContext } from './platform/context.ts';
import { CONSTRAINT_SOURCE, DEBUG_LEVEL, FETCH_DEST, FILE_ERROR_METHOD, HTTPS_PREFIX, RELOAD_METHOD } from './keys.ts';
import { APP_TEXT as TEXT } from './text.ts';

const ignore = (): void => undefined;

export type SharedServices = Readonly<{
  context: WrapperContext;
  login: ReturnType<typeof createLogin>;
  serverListFeature: (client: string) => WrapperFeature | null;
  joinTarget: () => (JoinPage & PinnedTarget) | null;
  watchCookies: (refresh: () => Promise<void>) => void;
  crashPorts: (client: string) => CrashPorts;
}>;

export type ClientRuntime = ReturnType<typeof createClientRuntime>;

type GameFolderEnvironment = Readonly<{ client: string; gameDir: string | null; gameVersion: string | null }>;

export function gameFolderOf(client: GameClient, environment: GameFolderEnvironment) {
  const isChosen = client.id === environment.client;
  const root = path.resolve((isChosen && environment.gameDir) || client.gameDir);
  const version = readGameVersion(root, isChosen ? environment.gameVersion : null);
  const isMissing = !version || !fsSync.existsSync(path.join(root, INDEX_FILE));
  return Object.freeze({ root, version, isMissing });
}

export function createClientRuntime(shared: SharedServices, client: GameClient) {
  const { context, login, joinTarget } = shared;
  const { environment, log } = context;
  const { flags, capabilities } = context.flagsFor(client.id);
  const isBundled = client.bundled;
  const usesSadburstAccounts = client.id === CLIENT.sadburst;
  const usesOfficialGate = client.id === CLIENT.sadburstErich5;
  const isRemoteHost = environment.mode === MODE.remote;
  const isDedicatedHost = environment.mode === MODE.server;
  const { remotePlayPart, p2pHostPart, serverListPart } = WRAPPER_PARTS;
  const { root, version } = gameFolderOf(client, environment);
  const host = client.host;
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

  let sessionCookies: { login: string | null; password: string | null; pb2uid: string | null } = { login: null, password: null, pb2uid: null };
  async function refreshSessionCookies(): Promise<void> {
    if (!flags.login.on || isBundled) {
      sessionCookies = { login: null, password: null, pb2uid: null };
      return;
    }
    const cookies = await siteCookiesIn(session.defaultSession.cookies).catch(() => []);
    const byName = new Map(cookies.map((cookie) => [cookie.name, cookie.value || null]));
    sessionCookies = {
      login: byName.get(COOKIE_NAME.login) ?? null,
      password: byName.get(COOKIE_NAME.password) ?? null,
      pb2uid: byName.get(COOKIE_NAME.pb2uid) ?? null,
    };
  }

  const wrapper = buildWrapper(
    WRAPPER_PARTS,
    { log, isCapabilityOn: (id: string) => capabilities[id]?.on ?? false, gameVersion: version || '', client: client.id, repoRoot: USER_ROOT, gameDir: root, devKvFile: devSettingsFile, host },
    {
      hooks: { namesFile: client.names, gamePrefix: prefix },
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
            pb2uid: current.pb2uid ?? sessionCookies.pb2uid,
          };
        },
        urlFromEnvironment: environment.diagnosticsUrl,
        keyFromEnvironment: environment.diagnosticsKey,
        fetch: (url, init) => net.fetch(url, { ...init, bypassCustomProtocolHandlers: true }),
        ...shared.crashPorts(client.id),
      },
    },
    shared.serverListFeature(client.id),
  );
  const isOn = (id: keyof typeof flags): boolean => flags[id].on;
  const intercept = createInterceptor(wrapper.features, isOn);
  const serveDev = createDevFiles({
    pageDir: PAGE_BUNDLE_DIR,
    namesFile: client.names,
    opcodesFile: client.opcodes,
    consoleOn: devConsoleOn,
    router: createDevRouter(wrapper.features, isOn),
  });
  const gameFiles = createGameFiles({ root, log, keepMissing: isBundled });

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
    fetch: (request) => (isBundled ? gameSession().fetch(request, { bypassCustomProtocolHandlers: true }) : net.fetch(request, { bypassCustomProtocolHandlers: true })),
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

  async function serveIndex(pageContext: PageContext): Promise<Response> {
    const html = await fs.readFile(path.join(root, INDEX_FILE), TEXT_ENCODING);
    const prepared = prepareIndex(html, {
      hooks: hooksOn && wrapper.hooks ? wrapper.hooks.injectIndex : null,
      pageScripts,
      join: joinTarget(),
      serverPage,
      remoteScript: pageContext.remote ? remotePlayPart?.pageScript ?? null : null,
      remoteNotMarked: remotePlayPart?.notMarked ?? '',
      verbose: log.on(DEBUG_LEVEL) && !isBundled,
      isServer: !!pageContext.server,
      accountScript: joinTarget() ? login.privateServerScript(client.id) : usesSadburstAccounts ? login.sadburstStartupScript() : usesOfficialGate ? login.gateStartupScript() : null,
    });
    for (const error of prepared.errors) log.error(error);
    for (const warning of prepared.warnings) log.warn(warning);
    return prepared.html === null ? textResponse(FILES_TEXT.notAvailable, UNAVAILABLE) : typedResponse(prepared.html, HTML_TYPE);
  }

  async function serveLocal(url: URL, pageContext: PageContext): Promise<Response> {
    let relative = decodeURIComponent(url.pathname.slice(prefix.length));
    if (relative === '' || relative.endsWith(FOLDER_END)) relative += INDEX_FILE;
    const preparesIndex = pageCoreOn || hooksOn || pageContext.remote || !!pageContext.server || !!joinTarget() || (usesSadburstAccounts && flags.login.on) || usesOfficialGate;
    if (preparesIndex && relative === INDEX_FILE) return serveIndex(pageContext);
    const hooked = hooksOn && wrapper.hooks ? wrapper.hooks.changedScript(relative) : null;
    if (hooked !== null) return typedResponse(hooked, SCRIPT_TYPE, false);
    return gameFiles.serveFile(relative, url, pageContext.fetch);
  }

  async function handleRequest(request: Request, pageContext: PageContext): Promise<Response> {
    const url = new URL(request.url);
    if (pageContext.remote && remotePlayPart?.refusesPageLoad(request.headers.get(FETCH_DEST), request.url, startUrl)) return textResponse(remotePlayPart.notAvailable, FORBIDDEN);
    const intercepted = await intercept(request, url, pageContext);
    if (intercepted) return intercepted;
    if (url.hostname === host && url.pathname.startsWith(prefix)) {
      if (pageCoreOn && url.pathname.startsWith(devPrefix)) return serveDev(decodeURIComponent(url.pathname.slice(devPrefix.length)), request, url, pageContext);
      return serveLocal(url, pageContext);
    }
    return pageContext.fetch(request);
  }

  const quietRoute = isHiddenFeature(EDITION, FEATURE.diagnostics) ? devPrefix + ROUTE_NAME.diagnostics : null;

  async function handleRequestLogged(request: Request, pageContext: PageContext): Promise<Response> {
    const isQuiet = quietRoute !== null && new URL(request.url).pathname.startsWith(quietRoute);
    if (isQuiet || !log.on(DEBUG_LEVEL)) return handleRequest(request, pageContext);
    const started = Date.now();
    const response = await handleRequest(request, pageContext);
    log.debug(PAGE_TEXT.request(pageContext.name, request.method, request.url, response.status, Date.now() - started));
    return response;
  }

  const isMissing = (): boolean => gameFolderOf(client, environment).isMissing;

  async function installOnce(): Promise<void> {
    if (devConsoleOn && seedKvFile(devSettingsFile, EDITION_DEFAULTS.settings)) log.info(TEXT.settingsSeeded(path.relative(USER_ROOT, devSettingsFile)));
    log.info(TEXT.gameFrom(isBundled ? TEXT.clientPrefix(client.title) : '', version ?? '', root));
    if (isBundled) {
      if (flags.hooks.source === CONSTRAINT_SOURCE) log.info(TEXT.sadburstHooksOff(client.title));
      void checkSadburstBuild({ root, site: client.site, prefix, title: client.title, folder: path.basename(client.gameDir), fetchFlag: client.fetchFlag, log, fetchLive: (url) => net.fetch(url, { bypassCustomProtocolHandlers: true, cache: NO_STORE }) });
    }
    log.debug(TEXT.debugLevel);
    if (pageCoreOn) {
      checkNamesFile({ namesFile: client.names, repoRoot: USER_ROOT, gameVersion: version, runFlag: client.runFlag, log });
      checkPageBundle({ pageDir: PAGE_BUNDLE_DIR, entries: devConsoleOn ? [PAGE_CORE_FILE, CONSOLE_BUNDLE_FILE] : [PAGE_CORE_FILE], log });
    }
    if (!isRemoteHost && !isDedicatedHost && flags.cert_pinning.on) pinCertificates(gameSession(), joinTarget, log);
    await refreshSessionCookies();
    shared.watchCookies(refreshSessionCookies);
    const pageContext = isDedicatedHost ? serverContext : localContext;
    const handler = (request: Request): Promise<Response> => handleRequestLogged(request, pageContext);
    if (isBundled) gameSession().protocol.handle(HTTPS_SCHEME, handler);
    else protocol.handle(HTTPS_SCHEME, handler);
  }

  const install = onceUntilItFails(installOnce);

  function openWindow(title: string): BrowserWindow {
    const window = new BrowserWindow({
      width: MAIN_WINDOW.width,
      height: MAIN_WINDOW.height,
      autoHideMenuBar: true,
      title,
      webPreferences: { backgroundThrottling: false, partition: client.partition ?? undefined },
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
    void window.loadURL(startUrl);
    return window;
  }

  async function startRemoteHost(): Promise<void> {
    const started = await remotePlayPart?.start({ log, args: environment.args, startUrl, handleRequest: handleRequestLogged, applyLogin: (cookies) => login.applyQuietly(cookies) });
    if (!started) app.quit();
  }

  async function startDedicatedHost(): Promise<void> {
    if (!p2pHostPart || !serverSettingsFile || !serverSettings) return;
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
  }

  return Object.freeze({
    client,
    flags,
    root,
    version,
    startUrl,
    isMissing,
    install,
    openWindow,
    startRemoteHost,
    startDedicatedHost,
    hasServerListPart: serverListPart !== undefined,
    window: liveWindow,
  });
}

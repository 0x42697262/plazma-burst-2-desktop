import { DATA_FOLDER_NAME } from '#kernel/config/paths.ts';
import fsSync from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { BrowserWindow } from 'electron';
import type { Logger } from '#kernel/log/logger.ts';
import { loadConfig } from './config-file.ts';
import { parseServerArgs, type Match, type ServerSettings } from '../domain/config.ts';
import { EXAMPLE_CONFIG_FILE_NAME } from '../keys.ts';
import { HOST_WINDOW, MILLISECONDS_PER_SECOND, QUIT_AFTER_STOP_MS, RELOAD_AFTER_CRASH_MS } from '../constants.ts';
import { HOST_LOG } from '../text.ts';
import type { KvFile } from '#wrapper/platform/kv-file.ts';
import { CLOSE_EVENT, INTERRUPT_SIGNAL, LINE_EVENT, QUIT_WORDS, STOP_SERVER_SCRIPT, WINDOW_EVENT, runConsoleLineScript } from '#wrapper/platform/keys.ts';
import { logServerPage } from './page-log.ts';

export type ServerPage = { match: Match; server: ServerSettings };
export type DedicatedHostDeps = {
  log: Logger;
  args: readonly string[];
  defaultConfigFile: string;
  devConsoleOn: boolean;
  namesFile: string;
  settingsFile: string;
  settings: KvFile;
  startUrl: string;
  findLocalMap: (name: string) => Promise<unknown>;
  mapsDir: string;
  setServerPage: (page: ServerPage) => void;
  setWindow: (window: BrowserWindow) => void;
  quit: () => void;
  exit: () => void;
};

const ignore = (): void => undefined;

function watchSettings(settings: KvFile, settingsFile: string, log: Logger): void {
  try {
    settings.watch();
  } catch (error) {
    log.warn(HOST_LOG.notWatching(settingsFile, (error as Error).message));
  }
}

async function loadServerPage(deps: DedicatedHostDeps): Promise<{ page: ServerPage; file: string } | null> {
  const { log, args, defaultConfigFile } = deps;
  const { config, problems: argProblems } = parseServerArgs(args);
  for (const problem of argProblems) log.warn(HOST_LOG.problem(problem));
  const file = config ? path.resolve(config) : defaultConfigFile;
  const loaded = loadConfig(file);
  if (loaded.missing) {
    log.error(HOST_LOG.missingConfig(file, path.join(DATA_FOLDER_NAME, EXAMPLE_CONFIG_FILE_NAME)));
    return null;
  }
  for (const problem of loaded.problems) log.warn(HOST_LOG.problem(problem));
  if (loaded.errors.length || !loaded.match || !loaded.server) {
    for (const problem of loaded.errors) log.error(HOST_LOG.problem(problem));
    log.error(HOST_LOG.fixConfig(file));
    return null;
  }
  if (!deps.devConsoleOn) {
    log.error(HOST_LOG.needsConsole);
    return null;
  }
  if (!fsSync.existsSync(deps.namesFile)) log.warn(HOST_LOG.namesMissing);
  const localMap = loaded.server.local_map;
  if (localMap && !(await deps.findLocalMap(localMap))) {
    log.error(HOST_LOG.localMapMissing(localMap, deps.mapsDir));
    return null;
  }
  return { page: { match: loaded.match, server: loaded.server }, file };
}

export async function startDedicatedServer(deps: DedicatedHostDeps): Promise<void> {
  const { log, startUrl } = deps;
  const loaded = await loadServerPage(deps);
  if (!loaded) {
    deps.quit();
    return;
  }
  const { page, file } = loaded;
  deps.setServerPage(page);
  log.info(HOST_LOG.settingsFrom(file));

  const window = new BrowserWindow({
    show: false,
    width: HOST_WINDOW.width,
    height: HOST_WINDOW.height,
    useContentSize: true,
    title: HOST_LOG.windowTitle,
    webPreferences: { backgroundThrottling: false, offscreen: true },
  });
  deps.setWindow(window);
  window.webContents.setAudioMuted(true);
  window.webContents.setFrameRate(page.server.fps);
  const ports = page.server.udp_ports;
  if (ports) {
    window.webContents.setWebRTCUDPPortRange(ports);
    log.info(HOST_LOG.udpPorts(ports.min, ports.max));
  }
  logServerPage(window, log);
  window.webContents.on(WINDOW_EVENT.processGone, (_event, details) => {
    log.error(HOST_LOG.processGone(details.reason, details.exitCode, RELOAD_AFTER_CRASH_MS / MILLISECONDS_PER_SECOND));
    setTimeout(() => {
      if (!window.isDestroyed()) void window.loadURL(startUrl);
    }, RELOAD_AFTER_CRASH_MS);
  });
  watchSettings(deps.settings, deps.settingsFile, log);

  let quitting = false;
  const quit = (): void => {
    if (quitting) {
      deps.exit();
      return;
    }
    quitting = true;
    log.info(HOST_LOG.quitting);
    window.webContents.executeJavaScript(STOP_SERVER_SCRIPT).catch(ignore);
    setTimeout(deps.quit, QUIT_AFTER_STOP_MS);
  };
  const terminal = readline.createInterface({ input: process.stdin, terminal: false });
  terminal.on(LINE_EVENT, (line: string) => {
    const text = line.trim();
    if (!text) return;
    if (QUIT_WORDS.test(text)) {
      quit();
      return;
    }
    window.webContents.executeJavaScript(runConsoleLineScript(text))
      .then((ran: unknown) => { if (!ran) log.warn(HOST_LOG.consoleNotLoaded); })
      .catch((error: unknown) => { log.error(HOST_LOG.problem((error as Error).message)); });
  });
  terminal.on(CLOSE_EVENT, () => { if (!quitting) log.info(HOST_LOG.inputClosed); });
  process.on(INTERRUPT_SIGNAL, quit);

  log.info(HOST_LOG.starting);
  await window.loadURL(startUrl);
}

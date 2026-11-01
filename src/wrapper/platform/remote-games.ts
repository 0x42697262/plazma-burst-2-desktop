import fs from 'node:fs/promises';
import path from 'node:path';
import { BrowserWindow, session, type NativeImage, type Session } from 'electron';
import type { Logger } from '#kernel/log/logger.ts';
import { PARTITION_PREFIX, TESTER_SETTINGS_FILE_NAME } from '#features/remote_play/keys.ts';
import { REMOTE_WEB_PREFERENCES } from '#features/remote_play/constants.ts';
import { TEXT as REMOTE_TEXT } from '#features/remote_play/text.ts';
import { REMOTE_DATA_DIR } from '#features/remote_play/paths.ts';
import { lockDownSession, lockDownWindow, type LockableWindow } from '#features/remote_play/adapters/lockdown.ts';
import type { RemoteGame, FrameEncoder } from '#features/remote_play/services/host.ts';
import type { Tester } from '#features/remote_play/adapters/testers-file.ts';
import type { HostOptions } from '#features/remote_play/domain/host-args.ts';
import type { InputEvent } from '#features/remote_play/domain/input.ts';
import { HTTPS_SCHEME, WINDOW_EVENT } from './keys.ts';
import { createKvFile } from './kv-file.ts';
import { logPage } from './page-log.ts';
import type { PageContext } from './context.ts';

type MutableContext = Omit<PageContext, 'window'> & { window: BrowserWindow | null };
type HandleRequest = (request: Request, context: PageContext) => Promise<Response>;
export type RemoteGameDeps = { log: Logger; startUrl: string; handleRequest: HandleRequest; applyLogin: (cookies: Session['cookies']) => Promise<void> };

const ignore = (): void => undefined;

export function createRemoteGames({ log, startUrl, handleRequest, applyLogin }: RemoteGameDeps) {
  const contexts = new Map<string, MutableContext>();

  async function remoteSession(name: string): Promise<{ testerSession: Session; context: MutableContext }> {
    const testerSession = session.fromPartition(PARTITION_PREFIX + name);
    let context = contexts.get(name);
    if (!context) {
      lockDownSession(testerSession);
      const folder = path.join(REMOTE_DATA_DIR, name);
      await fs.mkdir(folder, { recursive: true });
      const created: MutableContext = {
        remote: true,
        name,
        window: null,
        fetch: (request) => testerSession.fetch(request, { bypassCustomProtocolHandlers: true }),
        kvFile: createKvFile(path.join(folder, TESTER_SETTINGS_FILE_NAME), { onChange: ignore, onError: ignore }),
      };
      context = created;
      contexts.set(name, created);
      testerSession.protocol.handle(HTTPS_SCHEME, (request) => handleRequest(request, created));
    }
    await applyLogin(testerSession.cookies);
    return { testerSession, context };
  }

  async function createRemoteGame(tester: Tester, options: HostOptions): Promise<RemoteGame> {
    const { testerSession, context } = await remoteSession(tester.name);
    const window = new BrowserWindow({
      show: false,
      width: options.width,
      height: options.height,
      useContentSize: true,
      title: REMOTE_TEXT.windowTitle(tester.name),
      webPreferences: { ...REMOTE_WEB_PREFERENCES, session: testerSession, offscreen: true },
    });
    lockDownWindow(window as unknown as LockableWindow, startUrl);
    window.webContents.setAudioMuted(true);
    window.webContents.setFrameRate(options.fps);
    logPage(window, tester.name, log);
    context.window = window;

    const frameListeners = new Set<(encode: FrameEncoder) => void>();
    window.webContents.on(WINDOW_EVENT.paint, (_event, _dirty, image: NativeImage) => {
      if (!frameListeners.size) return;
      let jpeg: Buffer | null = null;
      const encode: FrameEncoder = () => (jpeg ??= image.toJPEG(options.quality));
      for (const listener of frameListeners) listener(encode);
    });
    const goneListeners: (() => void)[] = [];
    let gone = false;
    const markGone = (): void => {
      if (gone) return;
      gone = true;
      for (const listener of goneListeners) listener();
    };
    window.webContents.on(WINDOW_EVENT.processGone, markGone);
    window.on(WINDOW_EVENT.closed, markGone);

    await window.loadURL(startUrl);
    return {
      size: { width: options.width, height: options.height },
      onFrame(listener) {
        frameListeners.add(listener);
        return () => { frameListeners.delete(listener); };
      },
      sendInput(event: InputEvent) {
        if (!window.isDestroyed()) window.webContents.sendInputEvent(event as unknown as Electron.KeyboardInputEvent);
      },
      focus() {
        if (!window.isDestroyed()) window.webContents.focus();
      },
      refresh() {
        if (!window.isDestroyed()) window.webContents.invalidate();
      },
      destroy() {
        gone = true;
        if (context.window === window) context.window = null;
        if (!window.isDestroyed()) window.destroy();
      },
      onGone(listener) { goneListeners.push(listener); },
    };
  }

  return { createRemoteGame };
}

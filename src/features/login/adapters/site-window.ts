import type { BrowserWindow as ElectronWindow, Session } from 'electron';
import { COOKIES_CHANGED, LOGIN_PARTITION_PREFIX, SITE, WINDOW_CLOSED, WINDOW_OPEN_DENY } from '../keys.ts';
import { LOGIN_WINDOW } from '../constants.ts';
import type { OpenSiteWindow } from '../services/new-login.ts';

type SiteWindowDeps = {
  BrowserWindow: new (options: Electron.BrowserWindowConstructorOptions) => ElectronWindow;
  session: { fromPartition(partition: string): Session };
  parent: () => ElectronWindow | null;
};

let opened = 0;

export const siteWindowOpener = ({ BrowserWindow, session, parent }: SiteWindowDeps): OpenSiteWindow => (url) => {
  const memoryOnly = session.fromPartition(LOGIN_PARTITION_PREFIX + String(++opened));
  const window = new BrowserWindow({
    ...LOGIN_WINDOW,
    parent: parent() ?? undefined,
    autoHideMenuBar: true,
    webPreferences: { session: memoryOnly },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: WINDOW_OPEN_DENY }));
  void window.loadURL(url);
  return {
    cookies: () => memoryOnly.cookies.get({ domain: SITE }),
    onChange(listener) { memoryOnly.cookies.on(COOKIES_CHANGED, listener); },
    onClosed(listener) { window.on(WINDOW_CLOSED, listener); },
    check: (checkUrl) => memoryOnly.fetch(checkUrl).then((response) => response.status),
    close() {
      if (!window.isDestroyed()) window.destroy();
      void memoryOnly.clearStorageData();
    },
  };
};

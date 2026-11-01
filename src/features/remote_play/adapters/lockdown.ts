import { WINDOW_EVENT, WINDOW_OPEN_DENIED } from '../keys.ts';
import { isBlockedKey, fromElectronInput, type ElectronInput } from '../domain/blocked-keys.ts';
import { isGamePage } from '../domain/game-page.ts';

type Preventable = { preventDefault(): void };
type DownloadItem = { cancel(): void };
type DisplayMediaCallback = (streams: Record<string, never>) => void;

export type LockableSession = {
  setPermissionRequestHandler(handler: (contents: unknown, permission: string, callback: (granted: boolean) => void) => void): void;
  setPermissionCheckHandler(handler: () => boolean): void;
  setDevicePermissionHandler?(handler: () => boolean): void;
  setDisplayMediaRequestHandler?(handler: (request: unknown, callback: DisplayMediaCallback) => void): void;
  on(event: string, listener: (event: Preventable, item: DownloadItem) => void): void;
};

type LockableContents = {
  setWindowOpenHandler(handler: () => typeof WINDOW_OPEN_DENIED): void;
  on(event: string, listener: (event: Preventable, detail: never) => void): void;
  closeDevTools(): void;
};
export type LockableWindow = { setMenu(menu: null): void; webContents: LockableContents };

const refuse = (): boolean => false;

export function lockDownSession(session: LockableSession): void {
  session.setPermissionRequestHandler((_contents, _permission, callback) => { callback(false); });
  session.setPermissionCheckHandler(refuse);
  session.setDevicePermissionHandler?.(refuse);
  session.setDisplayMediaRequestHandler?.((_request, callback) => { callback({}); });
  session.on(WINDOW_EVENT.download, (_event, item) => { item.cancel(); });
}

export function lockDownWindow(window: LockableWindow, startUrl: string): void {
  const contents = window.webContents;
  window.setMenu(null);
  contents.setWindowOpenHandler(() => WINDOW_OPEN_DENIED);
  const stayOnGamePage = (event: Preventable, url: string): void => {
    if (!isGamePage(url, startUrl)) event.preventDefault();
  };
  contents.on(WINDOW_EVENT.navigate, stayOnGamePage);
  contents.on(WINDOW_EVENT.redirect, stayOnGamePage);
  contents.on(WINDOW_EVENT.attachWebview, (event) => { event.preventDefault(); });
  contents.on(WINDOW_EVENT.devtoolsOpened, () => { contents.closeDevTools(); });
  contents.on(WINDOW_EVENT.beforeInput, (event, input: ElectronInput) => {
    if (isBlockedKey(fromElectronInput(input))) event.preventDefault();
  });
}

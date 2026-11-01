import { BrowserWindow } from 'electron';
import { PROGRESS_WINDOW } from '../constants.ts';
import { PROGRESS_PAGE, showLineScript } from '../keys.ts';

export type ProgressWindow = Readonly<{ show(line: string): void; close(): void }>;

const ignore = (): void => undefined;

export function openProgressWindow(title: string): ProgressWindow {
  const window = new BrowserWindow({ ...PROGRESS_WINDOW, title, resizable: false, minimizable: false, autoHideMenuBar: true });
  const loaded = window.loadURL(PROGRESS_PAGE(title)).catch(ignore);
  return Object.freeze({
    show: (line: string) => {
      void loaded.then(() => (window.isDestroyed() ? undefined : window.webContents.executeJavaScript(showLineScript(line)))).catch(ignore);
    },
    close: () => {
      if (!window.isDestroyed()) window.close();
    },
  });
}

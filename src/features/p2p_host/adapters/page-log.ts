import type { BrowserWindow } from 'electron';
import type { Logger } from '#kernel/log/logger.ts';
import type { ConsoleMessage } from '#wrapper/platform/page-log.ts';
import { WINDOW_EVENT } from '#wrapper/platform/keys.ts';
import { pageLine } from '../domain/page-log.ts';
import { HOST_LOG } from '../text.ts';

export function logServerPage(window: BrowserWindow, log: Logger): void {
  window.webContents.on(WINDOW_EVENT.consoleMessage, (event: ConsoleMessage) => {
    const line = pageLine({ message: String(event.message), level: event.level, sourceId: event.sourceId, lineNumber: event.lineNumber });
    log[line.level](line.text);
  });
  window.webContents.on(WINDOW_EVENT.failLoad, (_event, code, description, url) => { log.error(HOST_LOG.failedLoad(url, description, code)); });
  window.on(WINDOW_EVENT.unresponsive, () => { log.warn(HOST_LOG.unresponsive); });
  window.on(WINDOW_EVENT.responsive, () => { log.info(HOST_LOG.responsive); });
}

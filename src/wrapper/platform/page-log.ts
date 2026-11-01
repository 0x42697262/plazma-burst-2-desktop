import type { BrowserWindow } from 'electron';
import type { Logger } from '#kernel/log/logger.ts';
import { DEFAULT_PAGE_LEVEL, PAGE_LEVEL, WINDOW_EVENT } from './keys.ts';
import { PAGE_TEXT as TEXT } from './text.ts';

export type ConsoleMessage = { message: string; level: string; sourceId?: string; lineNumber?: number };

export function logPage(window: BrowserWindow, who: string, log: Logger): void {
  const tag = TEXT.tag(who);
  const contents = window.webContents;
  contents.on(WINDOW_EVENT.consoleMessage, (event: ConsoleMessage) => {
    const source = event.sourceId ? TEXT.source(event.sourceId, event.lineNumber ?? 0) : '';
    log[PAGE_LEVEL[event.level] ?? DEFAULT_PAGE_LEVEL](TEXT.message(tag, event.level, event.message, source));
  });
  contents.on(WINDOW_EVENT.failLoad, (_event, code, description, url) => { log.error(TEXT.failedLoad(tag, url, description, code)); });
  contents.on(WINDOW_EVENT.processGone, (_event, details) => { log.error(TEXT.processGone(tag, details.reason, details.exitCode)); });
  window.on(WINDOW_EVENT.unresponsive, () => { log.warn(TEXT.unresponsive(tag)); });
  window.on(WINDOW_EVENT.responsive, () => { log.info(TEXT.responsive(tag)); });
  contents.on(WINDOW_EVENT.navigate, (_event, url) => { log.debug(TEXT.navigated(tag, url)); });
  contents.on(WINDOW_EVENT.finishLoad, () => { log.debug(TEXT.loaded(tag)); });
}

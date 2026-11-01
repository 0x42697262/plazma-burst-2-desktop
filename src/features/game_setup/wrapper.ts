import { dialog } from 'electron';
import type { Logger } from '#kernel/log/logger.ts';
import type { GameClient } from '#kernel/config/clients.ts';
import { ensureGame } from './services/ensure-game.ts';
import { downloadsFor } from './adapters/downloads.ts';
import { openProgressWindow, type ProgressWindow } from './adapters/progress-window.ts';
import { TEXT } from './text.ts';
import { LINE_JOIN } from './keys.ts';

export type PrepareGame = Readonly<{ client: GameClient; gameDir: string; checksForUpdates: boolean; log: Logger }>;

async function prepareGame({ client, gameDir, checksForUpdates, log }: PrepareGame): Promise<boolean> {
  const progress: { window: ProgressWindow | null } = { window: null };
  const say = (line: string): void => {
    log.info(line);
    progress.window ??= openProgressWindow(TEXT.windowTitle(client.title));
    progress.window.show(line);
  };
  const note = (line: string): void => { log.info(line); };
  const result = await ensureGame(downloadsFor(client, gameDir, checksForUpdates, { say, note }));
  progress.window?.close();
  for (const problem of result.problems) {
    if (result.ready) log.warn(problem);
    else log.error(problem);
  }
  if (!result.ready) dialog.showErrorBox(TEXT.failedTitle(client.title), result.problems.join(LINE_JOIN));
  return result.ready;
}

export const gameSetupPart = Object.freeze({ prepare: prepareGame });

export type GameSetupPart = typeof gameSetupPart;

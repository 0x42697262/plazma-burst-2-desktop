import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { BACKUP_TEXT } from '../../text.ts';
import { gameSave } from '../../adapters/game.ts';
import { backupLocal } from '../../services/backup.ts';
import { TEXT } from './text.ts';

let isBackedUp = false;

async function backupOnce(): Promise<boolean> {
  if (isBackedUp) return true;
  try {
    print(TEXT.kept(await backupLocal(gameSave.loginParams().login, BACKUP_TEXT.beforeEdits)), COLOR.hint);
    isBackedUp = true;
    return true;
  } catch (error) {
    print(TEXT.backupFailed((error as Error).message), COLOR.error);
    return false;
  }
}

export async function change(apply: () => void): Promise<boolean> {
  if (!await backupOnce()) return false;
  apply();
  gameSave.saveFlush();
  return true;
}

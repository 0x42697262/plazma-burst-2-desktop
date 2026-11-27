import { STATUS } from '#shared/contract/keys.ts';
import { BACKUP_KIND } from '../keys.ts';
import { BACKUP_TEXT } from '../text.ts';
import { gameSave } from '../adapters/game.ts';
import { downloadSave, saveBackup } from '../adapters/wrapper-client.ts';
import { isNothingToLoad } from '../domain/answer.ts';

export async function backupOnline(login: string, reason: string): Promise<string | null> {
  const { status, text } = await downloadSave();
  if (status !== STATUS.ok) throw new Error(BACKUP_TEXT.siteRefused(status));
  if (isNothingToLoad(text)) return null;
  return saveBackup({ kind: BACKUP_KIND.online, login, reason, text });
}

export const backupLocal = (login: string, reason: string): Promise<string> =>
  saveBackup({ kind: BACKUP_KIND.local, login, reason, data: { ...gameSave.saveData() } });

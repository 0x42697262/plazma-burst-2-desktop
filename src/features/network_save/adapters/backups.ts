import fs from 'node:fs/promises';
import path from 'node:path';
import { decodeSaveText } from '#kernel/game-save/save-text.ts';
import { BACKUP_DIR_MODE, BACKUP_FILE_MODE, BACKUPS_KEPT, JSON_INDENT } from '../constants.ts';
import { BACKUP_EXTENSION, BACKUP_ID, BACKUP_KIND, NAME_JOIN, TEXT_ENCODING, TIME_IN_NAME, TIME_SEPARATOR } from '../keys.ts';

export type BackupKind = (typeof BACKUP_KIND)[keyof typeof BACKUP_KIND];
export type Backup = Readonly<{ id: string; at: number; kind: BackupKind; login: string; reason: string; data: Record<string, unknown> | null; text: string | null }>;
export type BackupSummary = Readonly<{ id: string; at: number; kind: BackupKind; login: string; reason: string; values: number }>;
export type BackupStore = Readonly<{ save(backup: Omit<Backup, 'id'>): Promise<string>; list(): Promise<BackupSummary[]>; read(id: string): Promise<Backup | null> }>;

const valuesOf = (backup: Backup): number => (backup.data ? Object.keys(backup.data).length : decodeSaveText(backup.text ?? '').size);

export function createBackupStore(dir: string): BackupStore {
  const fileOf = (id: string): string => path.join(dir, id + BACKUP_EXTENSION);
  async function ids(): Promise<string[]> {
    try {
      return (await fs.readdir(dir)).filter((file) => file.endsWith(BACKUP_EXTENSION)).map((file) => file.slice(0, -BACKUP_EXTENSION.length)).filter((id) => BACKUP_ID.test(id)).sort().reverse();
    } catch {
      return [];
    }
  }
  async function read(id: string): Promise<Backup | null> {
    if (!BACKUP_ID.test(id)) return null;
    try {
      return { ...JSON.parse(await fs.readFile(fileOf(id), TEXT_ENCODING)) as Omit<Backup, 'id'>, id };
    } catch {
      return null;
    }
  }
  return Object.freeze({
    async save(backup: Omit<Backup, 'id'>): Promise<string> {
      await fs.mkdir(dir, { recursive: true, mode: BACKUP_DIR_MODE });
      let id = [new Date(backup.at).toISOString().replace(TIME_IN_NAME, TIME_SEPARATOR), backup.kind].join(NAME_JOIN);
      for (let copy = 1; (await ids()).includes(id); copy++) id = [new Date(backup.at + copy).toISOString().replace(TIME_IN_NAME, TIME_SEPARATOR), backup.kind].join(NAME_JOIN);
      await fs.writeFile(fileOf(id), JSON.stringify(backup, null, JSON_INDENT), { mode: BACKUP_FILE_MODE });
      for (const old of (await ids()).slice(BACKUPS_KEPT)) await fs.rm(fileOf(old), { force: true });
      return id;
    },
    async list(): Promise<BackupSummary[]> {
      const found = await Promise.all((await ids()).map(read));
      return found.filter((backup): backup is Backup => backup !== null).map((backup) => ({ id: backup.id, at: backup.at, kind: backup.kind, login: backup.login, reason: backup.reason, values: valuesOf(backup) }));
    },
    read,
  });
}

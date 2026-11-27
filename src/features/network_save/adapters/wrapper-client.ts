import { ROUTE, withQuery } from '#shared/contract/routes.ts';
import { HTTP_METHOD, NO_STORE_CACHE } from '#shared/contract/keys.ts';
import type { SeenSaves } from '#kernel/game-save/seen.ts';
import { ACTION, ID_QUERY } from '../keys.ts';
import { gameSave } from './game.ts';

export type SiteAnswer = Readonly<{ status: number; text: string }>;

export async function seenSaves(): Promise<SeenSaves | null> {
  try {
    const response = await fetch(ROUTE.netsaves, { cache: NO_STORE_CACHE });
    return response.ok ? await response.json() as SeenSaves : null;
  } catch {
    return null;
  }
}

async function ask(action: string, text: string): Promise<SiteAnswer> {
  const { login, password } = gameSave.loginParams();
  const response = await fetch(ROUTE.netsave, {
    method: HTTP_METHOD.post,
    body: JSON.stringify({ action, url: gameSave.saveUrl(), login, password, text }),
  });
  if (!response.ok) throw new Error(await response.text());
  return await response.json() as SiteAnswer;
}

export const downloadSave = (): Promise<SiteAnswer> => ask(ACTION.load, '');
export const uploadSaveText = (text: string): Promise<SiteAnswer> => ask(ACTION.save, text);

export type BackupKind = 'local' | 'online';
export type BackupSummary = Readonly<{ id: string; at: number; kind: BackupKind; login: string; reason: string; values: number }>;
export type Backup = Readonly<{ id: string; at: number; kind: BackupKind; login: string; reason: string; data: Record<string, unknown> | null; text: string | null }>;

async function jsonOrThrow<Value>(response: Response): Promise<Value> {
  if (!response.ok) throw new Error(await response.text());
  return await response.json() as Value;
}

export async function saveBackup(backup: Readonly<{ kind: BackupKind; login: string; reason: string; data?: Record<string, unknown>; text?: string }>): Promise<string> {
  const saved = await jsonOrThrow<{ id: string }>(await fetch(ROUTE.netsaveBackups, { method: HTTP_METHOD.post, body: JSON.stringify(backup) }));
  return saved.id;
}

export const listBackups = async (): Promise<BackupSummary[]> => jsonOrThrow<BackupSummary[]>(await fetch(ROUTE.netsaveBackups, { cache: NO_STORE_CACHE }));

export const readBackup = async (id: string): Promise<Backup> => jsonOrThrow<Backup>(await fetch(withQuery(ROUTE.netsaveBackups, { [ID_QUERY]: id }), { cache: NO_STORE_CACHE }));

import { ROUTE } from '#shared/contract/routes.ts';
import { HTTP_METHOD, NO_STORE_CACHE } from '#shared/contract/keys.ts';
import type { SeenSaves } from '#kernel/game-save/seen.ts';
import { ACTION } from '../keys.ts';
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

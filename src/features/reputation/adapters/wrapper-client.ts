import { ROUTE } from '#shared/contract/routes.ts';
import { NO_STORE_CACHE } from '#shared/contract/keys.ts';
import type { SeenSaves } from '#kernel/game-save/seen.ts';

export async function seenSaves(): Promise<SeenSaves | null> {
  try {
    const response = await fetch(ROUTE.netsaves, { cache: NO_STORE_CACHE });
    return response.ok ? await response.json() as SeenSaves : null;
  } catch {
    return null;
  }
}

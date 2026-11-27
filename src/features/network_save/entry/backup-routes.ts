import { ROUTE_NAME } from '#shared/contract/keys.ts';
import { HTTP_METHOD, STATUS } from '#wrapper/http/keys.ts';
import { errorResponse, jsonResponse } from '#wrapper/http/responses.ts';
import type { DevRoute, RequestContext } from '#wrapper/feature-types.ts';
import { BACKUP_KIND, ID_QUERY } from '../keys.ts';
import { BACKUP_ROUTE_TEXT, ROUTE_TEXT } from '../text.ts';
import type { Backup, BackupStore } from '../adapters/backups.ts';

export type BackupRouteDeps = Readonly<{ store: BackupStore; clock: () => number; isOn: () => boolean }>;

function backupOf(body: unknown, at: number): Omit<Backup, 'id'> | null {
  if (!body || typeof body !== 'object') return null;
  const given = body as Record<string, unknown>;
  const isKind = given.kind === BACKUP_KIND.local || given.kind === BACKUP_KIND.online;
  const data = given.data && typeof given.data === 'object' && !Array.isArray(given.data) ? given.data as Record<string, unknown> : null;
  const text = typeof given.text === 'string' ? given.text : null;
  const hasContent = given.kind === BACKUP_KIND.local ? data !== null : text !== null;
  if (!isKind || !hasContent || typeof given.login !== 'string' || typeof given.reason !== 'string') return null;
  return { at, kind: given.kind as Backup['kind'], login: given.login, reason: given.reason, data, text };
}

export function backupRoutes({ store, clock, isOn }: BackupRouteDeps): DevRoute[] {
  async function handle(request: Request, url: URL, context: RequestContext): Promise<Response> {
    if (context.remote) return errorResponse(ROUTE_TEXT.notInRemotePlay, STATUS.forbidden);
    if (!isOn()) return errorResponse(BACKUP_ROUTE_TEXT.off, STATUS.forbidden);
    if (request.method === HTTP_METHOD.post) {
      let backup: Omit<Backup, 'id'> | null;
      try {
        backup = backupOf(await request.json(), clock());
      } catch {
        backup = null;
      }
      return backup ? jsonResponse({ id: await store.save(backup) }) : errorResponse(BACKUP_ROUTE_TEXT.badBackup, STATUS.badRequest);
    }
    const id = url.searchParams.get(ID_QUERY);
    if (id === null) return jsonResponse(await store.list());
    const found = await store.read(id);
    return found ? jsonResponse(found) : errorResponse(BACKUP_ROUTE_TEXT.noSuchBackup(id), STATUS.notFound);
  }
  return [{ name: ROUTE_NAME.netsaveBackups, handle }];
}

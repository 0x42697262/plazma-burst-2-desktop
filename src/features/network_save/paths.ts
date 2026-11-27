import path from 'node:path';
import { DATA_DIR } from '#kernel/config/paths.ts';
import { CLIENT, type ClientId } from '#shared/features/keys.ts';

const BACKUP_FOLDER: Readonly<Record<ClientId, string>> = Object.freeze({
  [CLIENT.official]: 'netsaves',
  [CLIENT.sadburst]: 'netsaves.sadburst',
  [CLIENT.sadburstErich5]: 'netsaves.sadburst-erich5',
});

export const backupsDir = (client: ClientId): string => path.join(DATA_DIR, BACKUP_FOLDER[client]);

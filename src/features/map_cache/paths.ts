import type { ClientId } from '#shared/features/keys.ts';
import { CLIENT_PATHS } from '#kernel/config/paths.ts';

export const mapsDir = (client: ClientId): string => CLIENT_PATHS[client].mapsDir;

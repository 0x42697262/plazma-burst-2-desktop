import path from 'node:path';
import { REPO_ROOT } from '#kernel/config/paths.ts';

export const mapsDir = (isSadburst: boolean): string => path.join(REPO_ROOT, 'desktop', isSadburst ? 'maps.sadburst' : 'maps');

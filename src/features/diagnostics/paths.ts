import path from 'node:path';
import { DATA_DIR } from '#kernel/config/paths.ts';
import { REPORTS_FILE } from './keys.ts';

export const DIAGNOSTICS_DIR = path.join(DATA_DIR, 'diagnostics');
export const REPORTS_PATH = path.join(DIAGNOSTICS_DIR, REPORTS_FILE);

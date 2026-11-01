import path from 'node:path';
import { REPO_ROOT, DIST_DIR, DATA_DIR } from '#kernel/config/paths.ts';
import { TESTERS_FILE_NAME } from './keys.ts';

export const TESTERS_FILE = path.join(DATA_DIR, TESTERS_FILE_NAME);
export { REMOTE_TESTER_DATA_DIR as REMOTE_DATA_DIR } from '#kernel/config/paths.ts';
export const CLIENT_SOURCE_DIR = path.join(REPO_ROOT, 'src', 'features', 'remote_play', 'client');
export const CLIENT_SCRIPT_SOURCE = path.join(CLIENT_SOURCE_DIR, 'client.ts');
export const CLIENT_DIST_DIR = path.join(DIST_DIR, 'remote-client');

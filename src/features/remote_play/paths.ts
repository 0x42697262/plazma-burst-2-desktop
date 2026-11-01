import path from 'node:path';
import { REPO_ROOT, DIST_DIR } from '#kernel/config/paths.ts';
import { REMOTE_DATA_DIR_NAME, TESTERS_FILE_NAME } from './keys.ts';

export const DESKTOP_DIR = path.join(REPO_ROOT, 'desktop');
export const TESTERS_FILE = path.join(DESKTOP_DIR, TESTERS_FILE_NAME);
export const REMOTE_DATA_DIR = path.join(DESKTOP_DIR, REMOTE_DATA_DIR_NAME);
export const CLIENT_SOURCE_DIR = path.join(REPO_ROOT, 'src', 'features', 'remote_play', 'client');
export const CLIENT_SCRIPT_SOURCE = path.join(CLIENT_SOURCE_DIR, 'client.ts');
export const CLIENT_DIST_DIR = path.join(DIST_DIR, 'remote-client');

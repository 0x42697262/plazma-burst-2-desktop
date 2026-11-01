import path from 'node:path';
import { REPO_ROOT, DIST_DIR, DATA_DIR } from '#kernel/config/paths.ts';
import { OLD_JOIN_FILE_NAME, SERVERS_FILE_NAME } from './keys.ts';

export const SERVERS_FILE = path.join(DATA_DIR, SERVERS_FILE_NAME);
export const OLD_JOIN_FILE = path.join(DATA_DIR, OLD_JOIN_FILE_NAME);
export const LAUNCHER_SOURCE_DIR = path.join(REPO_ROOT, 'src', 'features', 'server_list', 'launcher');
export const LAUNCHER_DIST_DIR = path.join(DIST_DIR, 'launcher');
export const LAUNCHER_PAGE = path.join(LAUNCHER_DIST_DIR, 'index.html');
export const LAUNCHER_PRELOAD = path.join(LAUNCHER_DIST_DIR, 'preload.cjs');
export const LAUNCHER_SCRIPT_SOURCE = path.join(LAUNCHER_SOURCE_DIR, 'page.ts');
export const LAUNCHER_PRELOAD_SOURCE = path.join(LAUNCHER_SOURCE_DIR, 'preload.ts');
export const LAUNCHER_STATIC_FILES: readonly string[] = Object.freeze(['index.html', 'launcher.css']);
export const LAUNCHER_SCRIPT_OUT = path.join(LAUNCHER_DIST_DIR, 'launcher.js');

import path from 'node:path';

import { CLIENT_DETAILS } from '#shared/clients/keys.ts';
import { CLIENT, type ClientId } from '#shared/features/keys.ts';
import { APP_ROOT, USER_ROOT } from './root.ts';

export { USER_ROOT };
export const REPO_ROOT = APP_ROOT;
export const DIST_DIR = path.join(REPO_ROOT, 'dist');
export const EDITIONS_DIR = path.join(REPO_ROOT, 'editions');
export const PAGE_BUNDLE_DIR = path.join(DIST_DIR, 'page');
export const WRAPPER_BUNDLE_DIR = path.join(DIST_DIR, 'wrapper');
export const PAGE_CORE_FILE = 'page.js';
export const CONSOLE_BUNDLE_FILE = 'console.js';

export const DATA_FOLDER_NAME = 'data';
export const DATA_DIR = path.join(USER_ROOT, DATA_FOLDER_NAME);
export const FEATURES_FILE = path.join(DATA_DIR, 'features.json');
export const SERVER_DATA_DIR = path.join(DATA_DIR, 'server');
export const NETLOG_DIR = path.join(DATA_DIR, 'netlogs');
export const SCREENSHOT_DIR = path.join(DATA_DIR, 'screenshots');
export const REMOTE_TESTER_DATA_DIR = path.join(DATA_DIR, 'remote-data');

export type ClientPaths = Readonly<{ gameDir: string; names: string; opcodes: string; mapsDir: string; fingerprintDir: string }>;

export const CLIENT_PATHS: Readonly<Record<ClientId, ClientPaths>> = Object.freeze({
  [CLIENT.official]: Object.freeze({
    gameDir: path.join(USER_ROOT, 'game'),
    names: path.join(DATA_DIR, CLIENT_DETAILS[CLIENT.official].namesFileName),
    opcodes: path.join(DATA_DIR, 'opcodes.js'),
    mapsDir: path.join(DATA_DIR, 'maps'),
    fingerprintDir: path.join(DATA_DIR, 'fingerprint'),
  }),
  [CLIENT.sadburst]: Object.freeze({
    gameDir: path.join(USER_ROOT, 'game.sadburst'),
    names: path.join(DATA_DIR, CLIENT_DETAILS[CLIENT.sadburst].namesFileName),
    opcodes: path.join(DATA_DIR, 'opcodes.sadburst.js'),
    mapsDir: path.join(DATA_DIR, 'maps.sadburst'),
    fingerprintDir: path.join(DATA_DIR, 'fingerprint.sadburst'),
  }),
  [CLIENT.sadburstErich5]: Object.freeze({
    gameDir: path.join(USER_ROOT, 'game.sadburst-erich5'),
    names: path.join(DATA_DIR, CLIENT_DETAILS[CLIENT.sadburstErich5].namesFileName),
    opcodes: path.join(DATA_DIR, 'opcodes.sadburst-erich5.js'),
    mapsDir: path.join(DATA_DIR, 'maps.sadburst-erich5'),
    fingerprintDir: path.join(DATA_DIR, 'fingerprint.sadburst-erich5'),
  }),
});

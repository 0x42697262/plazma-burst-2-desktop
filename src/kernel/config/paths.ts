import path from 'node:path';

const LEVELS_UP_TO_REPO = ['..', '..', '..'];

export const REPO_ROOT = path.resolve(import.meta.dirname, ...LEVELS_UP_TO_REPO);
export const DIST_DIR = path.join(REPO_ROOT, 'dist');
export const CONSOLE_BUNDLE_DIR = path.join(DIST_DIR, 'console');
export const CONSOLE_BUNDLE_FILE = 'index.js';

export const DATA_FOLDER_NAME = 'data';
export const DATA_DIR = path.join(REPO_ROOT, DATA_FOLDER_NAME);
export const FEATURES_FILE = path.join(DATA_DIR, 'features.json');
export const SERVER_DATA_DIR = path.join(DATA_DIR, 'server');
export const NETLOG_DIR = path.join(DATA_DIR, 'netlogs');
export const SCREENSHOT_DIR = path.join(DATA_DIR, 'screenshots');
export const REMOTE_TESTER_DATA_DIR = path.join(DATA_DIR, 'remote-data');

export const CLIENT_PATHS = Object.freeze({
  official: Object.freeze({
    gameDir: path.join(REPO_ROOT, 'game'),
    names: path.join(DATA_DIR, 'names.js'),
    opcodes: path.join(DATA_DIR, 'opcodes.js'),
    mapsDir: path.join(DATA_DIR, 'maps'),
    fingerprintDir: path.join(DATA_DIR, 'fingerprint'),
  }),
  sadburst: Object.freeze({
    gameDir: path.join(REPO_ROOT, 'game.sadburst'),
    names: path.join(DATA_DIR, 'names.sadburst.js'),
    opcodes: path.join(DATA_DIR, 'opcodes.sadburst.js'),
    mapsDir: path.join(DATA_DIR, 'maps.sadburst'),
    fingerprintDir: path.join(DATA_DIR, 'fingerprint.sadburst'),
  }),
});

import path from 'node:path';

const LEVELS_UP_TO_REPO = ['..', '..', '..'];

export const REPO_ROOT = path.resolve(import.meta.dirname, ...LEVELS_UP_TO_REPO);
export const DIST_DIR = path.join(REPO_ROOT, 'dist');
export const CONSOLE_BUNDLE_DIR = path.join(DIST_DIR, 'console');
export const CONSOLE_BUNDLE_FILE = 'index.js';
export const FEATURES_FILE = path.join(REPO_ROOT, 'features.json');
export const DESKTOP_DIR = path.join(REPO_ROOT, 'desktop');
export const DEV_DATA_DIR = path.join(DESKTOP_DIR, 'dev');

export const CLIENT_PATHS = Object.freeze({
  official: Object.freeze({
    gameDir: path.join(REPO_ROOT, 'game'),
    names: path.join(DEV_DATA_DIR, 'names.js'),
    opcodes: path.join(DEV_DATA_DIR, 'opcodes.js'),
  }),
  sadburst: Object.freeze({
    gameDir: path.join(REPO_ROOT, 'game.sadburst'),
    names: path.join(DEV_DATA_DIR, 'names.sadburst.js'),
    opcodes: path.join(DEV_DATA_DIR, 'opcodes.sadburst.js'),
  }),
});

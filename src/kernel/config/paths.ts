import path from 'node:path';

const LEVELS_UP_TO_REPO = ['..', '..', '..'];

export const REPO_ROOT = path.resolve(import.meta.dirname, ...LEVELS_UP_TO_REPO);
export const DIST_DIR = path.join(REPO_ROOT, 'dist');
export const CONSOLE_BUNDLE_DIR = path.join(DIST_DIR, 'console');
export const CONSOLE_BUNDLE_FILE = 'index.js';
export const FEATURES_FILE = path.join(REPO_ROOT, 'features.json');

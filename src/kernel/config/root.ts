import path from 'node:path';
import { LEVELS_UP_TO_REPO } from './constants.ts';

export const APP_ROOT = path.resolve(import.meta.dirname, ...LEVELS_UP_TO_REPO);
export const USER_ROOT = APP_ROOT;

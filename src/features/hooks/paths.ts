import path from 'node:path';
import { DIST_DIR, REPO_ROOT, USER_ROOT } from '#kernel/config/paths.ts';

export const HOOKS_DIR = path.join(USER_ROOT, 'hooks');
export const RUNTIME_SOURCE = path.join(REPO_ROOT, 'src', 'features', 'hooks', 'runtime', 'runtime.ts');
export const RUNTIME_BUNDLE = path.join(DIST_DIR, 'hooks', 'runtime.cjs');

import path from 'node:path';
import { APP_ROOT } from '#kernel/config/root.ts';

export const WEB_PAGE_DIR = path.join(APP_ROOT, 'dist', 'web', 'page');

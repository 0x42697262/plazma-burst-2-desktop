import path from 'node:path';
import { REPO_ROOT } from '#kernel/config/paths.ts';

export const NETLOG_DIR_NAME = 'netlogs';
export const NETLOG_DIR = path.join(REPO_ROOT, NETLOG_DIR_NAME);

import path from 'node:path';
import { REPO_ROOT } from '#kernel/config/paths.ts';

export const FETCH_OPCODES = path.join(REPO_ROOT, 'src', 'tools', 'fetch-opcodes', 'cli.ts');

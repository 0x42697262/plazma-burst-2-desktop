import path from 'node:path';
import fs from 'node:fs';
import { CLIENTS } from '#kernel/config/clients.ts';
import { moveLegacyDataAndTell } from '#kernel/data/move.ts';
import { REPO_ROOT } from '#kernel/config/paths.ts';
import { render } from './dump.ts';
import { TEXT } from './keys.ts';

moveLegacyDataAndTell(REPO_ROOT);

const FIRST_USER_ARGUMENT = 2;
const gameDir = path.resolve(process.argv[FIRST_USER_ARGUMENT] ?? CLIENTS.official.gameDir);

try {
  if (!fs.existsSync(gameDir)) throw new Error(TEXT.noGame(gameDir));
  process.stdout.write(render(gameDir));
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 1;
}

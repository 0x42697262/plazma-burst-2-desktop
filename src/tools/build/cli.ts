import path from 'node:path';
import { REPO_ROOT } from '#kernel/config/paths.ts';
import { buildAll, watchAll } from './build.ts';
import { WATCH_FLAG } from './constants.ts';
import { TEXT } from './text.ts';

const wantsWatch = process.argv.includes(WATCH_FLAG);
if (wantsWatch) {
  await watchAll();
  console.log(TEXT.watching);
} else {
  for (const output of await buildAll()) console.log(TEXT.built(path.relative(REPO_ROOT, output)));
}

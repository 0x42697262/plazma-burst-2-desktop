import path from 'node:path';
import { REPO_ROOT } from '#kernel/config/paths.ts';
import { buildConsole, watchConsole } from './build.ts';
import { WATCH_FLAG } from './constants.ts';
import { TEXT } from './text.ts';

const wantsWatch = process.argv.includes(WATCH_FLAG);
if (wantsWatch) {
  await watchConsole();
  console.log(TEXT.watching);
} else {
  const outfile = await buildConsole();
  console.log(TEXT.built(path.relative(REPO_ROOT, outfile)));
}

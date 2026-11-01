import fs from 'node:fs';
import path from 'node:path';
import { CLIENTS, clientFor, withoutClientFlag } from '#kernel/config/clients.ts';
import { CLIENT } from '#shared/features/keys.ts';
import { ARG, TEXT_ENCODING } from './keys.ts';
import { TEXT } from './text.ts';
import { decode, loadStrings } from './find-names.ts';
import { run } from './run.ts';
import { loadCode, run as runSadburst } from './sadburst.ts';
import { moveLegacyDataAndTell } from '#kernel/data/move.ts';
import { REPO_ROOT } from '#kernel/config/paths.ts';

moveLegacyDataAndTell(REPO_ROOT);

const FIRST_USER_ARGUMENT = 2;
const PROBLEM_EXIT_CODE = 1;
const FAILED_EXIT_CODE = 2;

type Options = { gameDir?: string; out?: string; check?: boolean; decode?: string };

function parseArgs(args: readonly string[]): Options | null {
  const options: Options = {};
  for (let index = 0; index < args.length; index++) {
    const arg = args[index] ?? '';
    if (arg === ARG.out) options.out = args[++index];
    else if (arg === ARG.check) options.check = true;
    else if (arg === ARG.decode) options.decode = args[++index];
    else if (arg === ARG.help || arg === ARG.helpShort) return null;
    else options.gameDir = arg;
  }
  return options;
}

function main(): void {
  const isSadburst = clientFor().id === CLIENT.sadburst;
  const options = parseArgs(withoutClientFlag(process.argv.slice(FIRST_USER_ARGUMENT)));
  if (!options) {
    console.log(TEXT.usage);
    return;
  }
  if (options.decode) {
    const client = isSadburst ? CLIENTS.sadburst : CLIENTS.official;
    const gameDir = path.resolve(options.gameDir || client.gameDir);
    const source = fs.readFileSync(path.join(gameDir, options.decode), TEXT_ENCODING);
    const strings = isSadburst ? loadCode(gameDir).strings : loadStrings(gameDir);
    process.stdout.write(decode(source, strings));
    return;
  }
  const result = isSadburst ? runSadburst(options) : run(options);
  process.exitCode = result.missing.length || result.problems.length ? PROBLEM_EXIT_CODE : 0;
}

try {
  main();
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = FAILED_EXIT_CODE;
}

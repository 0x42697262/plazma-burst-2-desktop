import { TESTERS_FILE } from './paths.ts';
import { CLI_TEXT } from './text.ts';
import { runTestersCli } from './entry/testers-cli.ts';

const FIRST_USER_ARGUMENT = 2;

try {
  process.exitCode = runTestersCli(process.argv.slice(FIRST_USER_ARGUMENT), TESTERS_FILE, console);
} catch (error) {
  console.error(CLI_TEXT.error((error as Error).message));
  process.exitCode = 1;
}

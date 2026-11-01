import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { FETCH_OPCODES } from './paths.ts';
import { FLAG, clientFor, withoutClientFlag, type GameClient } from '#kernel/config/clients.ts';
import { CLIENT } from '#shared/features/keys.ts';
import { run as findNames } from '../find-names/run.ts';
import { run as findSadburstNames } from '../find-names/sadburst.ts';
import { FAILED_EXIT_CODE, FIRST_USER_ARGUMENT, JOBS } from './constants.ts';
import { ARG, INHERIT_OUTPUT, VERSION_ARGUMENT, VERSION_PREFIX } from './keys.ts';
import { TEXT } from './text.ts';
import { fetchOfficial, latestVersion } from './fetch-game.ts';
import { fetchSadburst } from './sadburst.ts';

const PROBLEM_EXIT_CODE = 1;

type Options = { out: string; names: boolean; jobs: number; version: string | null };

function parseArgs(args: readonly string[], client: GameClient): Options | null {
  const options: Options = { out: client.gameDir, names: true, jobs: JOBS, version: null };
  for (let index = 0; index < args.length; index++) {
    const arg = args[index] ?? '';
    if (arg === ARG.out) options.out = path.resolve(args[++index] ?? '');
    else if (arg === ARG.noNames) options.names = false;
    else if (arg === ARG.jobs) options.jobs = Math.max(1, Number(args[++index]) || JOBS);
    else if (arg === ARG.help || arg === ARG.helpShort) return null;
    else if (VERSION_ARGUMENT.test(arg) && client.id === CLIENT.official) options.version = arg.startsWith(VERSION_PREFIX) ? arg : VERSION_PREFIX + arg;
    else throw new Error(TEXT.unknownArgument(arg));
  }
  return options;
}

function printProblems(problems: readonly string[]): void {
  if (!problems.length) return;
  console.log(TEXT.problems);
  for (const problem of problems) console.log(TEXT.problem(problem));
  process.exitCode = PROBLEM_EXIT_CODE;
}

function fetchOpcodes(extraArgs: readonly string[], notUpdated: string): void {
  console.log(TEXT.fetchingOpcodes);
  try {
    execFileSync(process.execPath, [FETCH_OPCODES, ...extraArgs], { stdio: INHERIT_OUTPUT });
  } catch {
    console.log(notUpdated);
  }
}

async function mainSadburst(client: GameClient, options: Options): Promise<void> {
  const fetched = await fetchSadburst(client, options);
  printProblems(fetched.problems);
  if (!options.names) return;
  console.log(TEXT.findingNames);
  const names = findSadburstNames({ gameDir: options.out });
  if (names.missing.length || names.problems.length) {
    console.log(TEXT.sadburstNamesMissing);
    process.exitCode = PROBLEM_EXIT_CODE;
  }
  fetchOpcodes([FLAG], TEXT.sadburstOpcodesNotUpdated);
}

async function main(): Promise<void> {
  const client = clientFor();
  const options = parseArgs(withoutClientFlag(process.argv.slice(FIRST_USER_ARGUMENT)), client);
  if (!options) {
    console.log(TEXT.usage);
    return;
  }
  if (client.id === CLIENT.sadburst) {
    await mainSadburst(client, options);
    return;
  }
  const version = options.version || (await latestVersion());
  const problems = await fetchOfficial({ version, out: options.out, jobs: options.jobs });
  if (options.names) {
    console.log(TEXT.findingNames);
    const names = findNames({ gameDir: options.out });
    if (names.missing.length || names.problems.length) {
      console.log(TEXT.namesMissing);
      process.exitCode = PROBLEM_EXIT_CODE;
    }
    fetchOpcodes([], TEXT.opcodesNotUpdated);
  }
  if (problems.length) process.exitCode = PROBLEM_EXIT_CODE;
}

main().catch((error: unknown) => {
  console.error(TEXT.failed((error as Error).message));
  process.exit(FAILED_EXIT_CODE);
});

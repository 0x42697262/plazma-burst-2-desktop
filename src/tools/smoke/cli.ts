import fs from 'node:fs';
import { CLI_ARGS_START, DEFAULT_COMMANDS, FAILED_EXIT_CODE } from './constants.ts';
import { parseSmokeArgs } from './args.ts';
import { runSmoke } from './smoke.ts';
import { TEXT } from './text.ts';

const { client, levelFile, commands, electronArgs, problem } = parseSmokeArgs(process.argv.slice(CLI_ARGS_START));
if (problem) {
  console.error(problem);
  process.exit(FAILED_EXIT_CODE);
}
const level = levelFile ? fs.readFileSync(levelFile, 'utf8') : null;
const result = await runSmoke({ client, level, electronArgs, commands: commands.length ? commands : DEFAULT_COMMANDS, report: (line) => console.log(line) });
for (const [line, printed] of result.output) {
  console.log(TEXT.command(line));
  for (const printedLine of printed) console.log(printedLine);
}

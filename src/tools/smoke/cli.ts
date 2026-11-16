import fs from 'node:fs';
import { CLI_ARGS_START, CLIENT_FLAG, LEVEL_FLAG, LINE_BREAKS, COMMAND_FLAG, DEFAULT_CLIENT, DEFAULT_COMMANDS, ELECTRON_ARGS_FLAG } from './constants.ts';
import { runSmoke } from './smoke.ts';
import { TEXT } from './text.ts';

const argv = process.argv.slice(CLI_ARGS_START);
const electronArgsStart = argv.indexOf(ELECTRON_ARGS_FLAG);
const ownArgs = electronArgsStart < 0 ? argv : argv.slice(0, electronArgsStart);
const electronArgs = electronArgsStart < 0 ? [] : argv.slice(electronArgsStart + 1);
const commands = ownArgs.flatMap((arg, index) => (ownArgs[index - 1] === COMMAND_FLAG ? [arg] : []));

const client = ownArgs[ownArgs.indexOf(CLIENT_FLAG) + 1] ?? DEFAULT_CLIENT;
const levelFile = ownArgs.includes(LEVEL_FLAG) ? ownArgs[ownArgs.indexOf(LEVEL_FLAG) + 1] ?? null : null;
if (levelFile && client !== DEFAULT_CLIENT) {
  console.error(TEXT.levelOfficialOnly);
  process.exit(1);
}
const level = levelFile ? fs.readFileSync(levelFile, 'utf8').replace(LINE_BREAKS, '') : null;
const result = await runSmoke({ client, level, electronArgs, commands: commands.length ? commands : DEFAULT_COMMANDS, report: (line) => console.log(line) });
for (const [line, printed] of result.output) {
  console.log(TEXT.command(line));
  for (const printedLine of printed) console.log(printedLine);
}

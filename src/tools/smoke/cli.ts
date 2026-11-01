import { CLI_ARGS_START, COMMAND_FLAG, DEFAULT_COMMANDS, ELECTRON_ARGS_FLAG } from './constants.ts';
import { runSmoke } from './smoke.ts';
import { TEXT } from './text.ts';

const argv = process.argv.slice(CLI_ARGS_START);
const electronArgsStart = argv.indexOf(ELECTRON_ARGS_FLAG);
const ownArgs = electronArgsStart < 0 ? argv : argv.slice(0, electronArgsStart);
const electronArgs = electronArgsStart < 0 ? [] : argv.slice(electronArgsStart + 1);
const commands = ownArgs.flatMap((arg, index) => (ownArgs[index - 1] === COMMAND_FLAG ? [arg] : []));

const result = await runSmoke({ electronArgs, commands: commands.length ? commands : DEFAULT_COMMANDS, report: (line) => console.log(line) });
for (const [line, printed] of result.output) {
  console.log(TEXT.command(line));
  for (const printedLine of printed) console.log(printedLine);
}

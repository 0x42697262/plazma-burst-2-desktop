import { TESTERS_COMMAND } from '../keys.ts';
import { CLI_TEXT } from '../text.ts';
import { addTester, listTesters, removeTester } from '../adapters/testers-file.ts';

export type CliOutput = { log(line: string): void; error(line: string): void };

export function runTestersCli([command, name]: readonly (string | undefined)[], file: string, output: CliOutput): number {
  if (command === TESTERS_COMMAND.add && name) {
    const tester = addTester(file, name);
    output.log(CLI_TEXT.added(tester.name));
    output.log(CLI_TEXT.link(tester.token));
    output.log(CLI_TEXT.linkExample);
    output.log(CLI_TEXT.linkWarning);
    return 0;
  }
  if (command === TESTERS_COMMAND.remove && name) {
    output.log(removeTester(file, name) ? CLI_TEXT.removed(name) : CLI_TEXT.noSuchTester(name));
    return 0;
  }
  if (command === TESTERS_COMMAND.list) {
    const testers = listTesters(file);
    if (!testers.length) output.log(CLI_TEXT.noTesters);
    for (const tester of testers) output.log(CLI_TEXT.testerRow(tester.name, tester.added));
    return 0;
  }
  output.error(CLI_TEXT.usage);
  return 1;
}

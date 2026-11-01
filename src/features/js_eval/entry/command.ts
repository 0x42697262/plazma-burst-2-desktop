import { print } from '../../../../desktop/dev/console/ui/log.js';
import { COLOR } from '../../../../desktop/dev/console/core/colors.js';
import { game } from '../../../../desktop/dev/console/game/bindings.js';
import { F } from '../../../../desktop/dev/console/game/fields.js';
import { printPair } from '../../../../desktop/dev/console/commands/help.js';
import { EXAMPLE_WIDTH } from '../constants.ts';
import { COMMAND, GAME_NAME, withSourceUrl } from '../keys.ts';
import { TEXT } from '../text.ts';

type Names = { typedName(key: string): string; namesVersion(): string };
const names = game as unknown as Names;
const fields = F as { HP: string; MAX_HP: string };
const example = (code: string, what: string): void => (printPair as (left: string, right: string, width: number) => void)(TEXT.example(code), what, EXAMPLE_WIDTH);

function printGuide(): void {
  const me = names.typedName(GAME_NAME.me);
  const chars = names.typedName(GAME_NAME.chars);
  print(TEXT.intro, COLOR.title);
  print(TEXT.lastValue);
  print(TEXT.objects);
  print(TEXT.examplesTitle, COLOR.title);
  for (const [code, what] of TEXT.examples) example(code, what);
  print(TEXT.obfuscatedTitle, COLOR.title);
  print(TEXT.escapes);
  example(me, TEXT.myIndex);
  example(TEXT.hpExpression(chars, me, fields.HP), TEXT.myHp);
  example(TEXT.setMaxHpExpression(chars, me, fields.MAX_HP), TEXT.setMaxHp);
  print(TEXT.namesFile(names.namesVersion()));
  for (const [code, what] of TEXT.nameExamples) example(code, what);
  print(TEXT.consoleLog);
  print(TEXT.api);
  print([[TEXT.clientOnly, COLOR.warn, true]]);
}

const indirectEval = (code: string): unknown => (0, eval)(code);

export const jsCommand = Object.freeze({
  remote: false,
  name: COMMAND.name,
  usage: TEXT.usage,
  desc: TEXT.description,
  handlesHelp: true,
  rawLine: true,
  renderHelp: printGuide,
  run: (_args: readonly string[], { rest }: { rest: string }): void => {
    const asksForHelp = !rest || rest.toLowerCase() === COMMAND.helpWord;
    if (asksForHelp) {
      printGuide();
      return;
    }
    print(String(indirectEval(withSourceUrl(rest))));
  },
});

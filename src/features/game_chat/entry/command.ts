import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { NAME_WIDTH } from '../constants.ts';
import { COMMAND } from '../keys.ts';
import { GAME_COMMANDS, TEXT } from '../text.ts';
import { gameChat } from '../adapters/game-chat.ts';
import { createGameCommands } from '../services/game-commands.ts';

function printGameHelp(): void {
  print(TEXT.helpTitle, COLOR.title);
  for (const [group, commands] of GAME_COMMANDS) {
    print(TEXT.group(group), COLOR.title);
    for (const [command, description] of commands) print(TEXT.row(command.padEnd(NAME_WIDTH), description));
  }
  print(TEXT.cheatNote, COLOR.hint);
  print([[TEXT.clientOnlyWarning, COLOR.warn, true], [TEXT.builtinState(gameChat.builtinOn()), COLOR.hint, true]]);
}

const commands = createGameCommands({
  chat: gameChat,
  say: (line, failed) => print(TEXT.gameLine(line), failed ? COLOR.error : COLOR.hint),
  done: (text) => print(text, COLOR.ok),
});

export const gameCommand = Object.freeze({
  name: COMMAND.name,
  usage: TEXT.usage,
  desc: TEXT.description,
  clientOnly: TEXT.clientOnly,
  handlesHelp: true,
  help: { about: TEXT.about, examples: TEXT.examples, notes: TEXT.notes, see: TEXT.see },
  run: (_args: readonly string[], { rest }: { rest: string }): void => {
    const asksForHelp = !rest || rest.toLowerCase() === COMMAND.helpWord;
    if (asksForHelp) printGameHelp();
    else commands.run(rest);
  },
});

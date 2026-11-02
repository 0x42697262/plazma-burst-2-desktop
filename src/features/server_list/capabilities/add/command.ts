import { SUBCOMMAND_WORDS } from '../../constants.ts';
import { COMMAND } from '../../keys.ts';
import { COMMAND_TEXT } from '../../text.ts';
import { parsePairs, textAfterWords } from '../../domain/command-words.ts';
import { reportingErrors, saveServer } from '../../services/console-actions.ts';
import { ADD_COMMAND } from './keys.ts';
import { ADD_TEXT as TEXT } from './text.ts';

export const addCommand = Object.freeze({
  parent: COMMAND.name,
  name: ADD_COMMAND.name,
  usage: TEXT.usage,
  desc: TEXT.desc,
  rawLine: true,
  help: { about: TEXT.about, examples: TEXT.examples, notes: [COMMAND_TEXT.passwordNote] },
  run: reportingErrors((_args, { rest }) => saveServer(parsePairs(textAfterWords(rest, SUBCOMMAND_WORDS)), TEXT.savedWord)),
});

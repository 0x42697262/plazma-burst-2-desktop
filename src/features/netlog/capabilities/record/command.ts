import { runKey } from '#console/kernel/commands/settings.ts';
import { COMMAND, OFF_WORD, ON_WORD, SETTING } from '../../keys.ts';
import { usageError } from '../../text.ts';
import { RECORD_COMMAND } from './keys.ts';
import { RECORD_TEXT as TEXT } from './text.ts';

const setRecording = (usage: string, word: string) => (args: readonly string[]): void => {
  if (args.length) throw new Error(usageError(usage));
  runKey(SETTING.netLog, [word]);
};

export const recordCommands = Object.freeze([
  { parent: COMMAND.name, name: RECORD_COMMAND.on, usage: TEXT.on.usage, desc: TEXT.on.description, help: { about: TEXT.on.about, see: TEXT.on.see }, run: setRecording(TEXT.on.usage, ON_WORD) },
  { parent: COMMAND.name, name: RECORD_COMMAND.off, usage: TEXT.off.usage, desc: TEXT.off.description, help: { about: TEXT.off.about, examples: TEXT.off.examples, see: TEXT.off.see }, run: setRecording(TEXT.off.usage, OFF_WORD) },
]);

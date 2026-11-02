import { runKey } from '#console/kernel/commands/settings.ts';
import { SETTING } from '#features/game_chat/keys.ts';
import { BUILTIN_COMMAND } from '../../keys.ts';
import { BUILTIN_TEXT } from '../../text.ts';

export const builtinCommand = Object.freeze({
  name: BUILTIN_COMMAND,
  usage: BUILTIN_TEXT.usage,
  desc: BUILTIN_TEXT.desc,
  help: { about: BUILTIN_TEXT.about, see: BUILTIN_TEXT.see },
  run: (args: string[]) => { runKey(SETTING.builtin, args); },
});

import { clearLog } from '../ui/log.ts';
import { turnPage } from '../ui/pager.ts';
import { closePanel } from '../ui/panel.ts';
import type { CommandDefinition } from './registry.ts';
import { CONSOLE_COMMAND } from './keys.ts';
import { CONSOLE_TEXT as TEXT } from './text.ts';

export const moreCommand: CommandDefinition = {
  name: CONSOLE_COMMAND.more,
  aliases: CONSOLE_COMMAND.moreAliases,
  usage: TEXT.more.usage,
  desc: TEXT.more.desc,
  help: { about: TEXT.more.about, see: TEXT.more.see },
  run: (args) => { turnPage(args[0]); },
};

export const chainTopic: CommandDefinition = {
  name: CONSOLE_COMMAND.chain,
  usage: TEXT.chain.usage,
  desc: TEXT.chain.desc,
  topicOnly: true,
  help: { also: [CONSOLE_COMMAND.chainAlso], about: TEXT.chain.about, examples: TEXT.chain.examples, see: TEXT.chain.see },
};

export const consoleCommands: readonly CommandDefinition[] = [
  {
    name: CONSOLE_COMMAND.clear,
    aliases: [CONSOLE_COMMAND.clearAlias],
    usage: TEXT.clear.usage,
    desc: TEXT.clear.desc,
    help: { about: TEXT.clear.about },
    run: clearLog,
  },
  {
    name: CONSOLE_COMMAND.close,
    aliases: [CONSOLE_COMMAND.closeAlias],
    usage: TEXT.close.usage,
    desc: TEXT.close.desc,
    help: { about: TEXT.close.about },
    run: closePanel,
  },
];

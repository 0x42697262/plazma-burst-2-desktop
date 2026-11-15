import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { CAPABILITY } from '#shared/features/keys.ts';
import { MESSAGE_NAME_WIDTH } from '../../constants.ts';
import { COMMAND } from '../../keys.ts';
import { MESSAGES } from '../../domain/constants.ts';
import { LIST_TEXT as TEXT } from './text.ts';

function wireList(): void {
  for (const message of MESSAGES) {
    const name = message.name.toLowerCase().padEnd(MESSAGE_NAME_WIDTH);
    print(TEXT.row(name, message.direction + (message.sendable ? '' : TEXT.receiveOnlyMark)), message.sendable ? undefined : COLOR.muted);
  }
}

export const listCommand = Object.freeze({
  parent: COMMAND.name, name: COMMAND.list, capability: CAPABILITY.wire.list,
  usage: TEXT.usage, desc: TEXT.desc, help: { about: TEXT.about, see: TEXT.see }, run: wireList,
});

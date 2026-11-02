import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { COMMAND } from '../../keys.ts';
import { profileContext as context, profileStore as profiles } from '../../adapters/store.ts';
import { TEXT as SHARED_TEXT } from '../../text.ts';
import { isNone, requireProfile } from '../../services/profile-view.ts';
import { CLEAR, ONLOAD_COMMAND } from './keys.ts';
import { ONLOAD_TEXT as TEXT } from './text.ts';

function onload(args: readonly string[]): void {
  const [name, ...rest] = args;
  if (!name) throw new Error(TEXT.onloadUsage);
  if (isNone(name)) throw new Error(SHARED_TEXT.noneIsReserved);
  if (!rest.length) {
    const now = profiles.exists(name) ? profiles.get(name).onload : '';
    print(now ? TEXT.onloadShown(name, now) : TEXT.runsNothing(name), now ? undefined : COLOR.notice);
    return;
  }
  const isClear = rest.length === 1 && rest[0]?.toLowerCase() === CLEAR;
  if (isClear) {
    requireProfile(name);
    profiles.setOnload(name, '');
    print(TEXT.onloadCleared(name), COLOR.ok);
    return;
  }
  const command = context.commandText(rest, TEXT.onloadUsage);
  profiles.setOnload(name, command);
  print(TEXT.onloadShown(name, command), COLOR.ok);
  print(TEXT.onloadWhen(name), COLOR.hint);
}

export const onloadCommand = Object.freeze({
  parent: COMMAND.name, name: ONLOAD_COMMAND.name, aliases: ONLOAD_COMMAND.aliases, usage: TEXT.usage, desc: TEXT.desc, help: { about: TEXT.about, examples: TEXT.examples, see: TEXT.see }, run: onload,
});

import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { COMMAND } from '../../keys.ts';
import { USE_MAX_ARGUMENTS } from '../../constants.ts';
import { profileContext as context, profileStore as profiles } from '../../adapters/store.ts';
import { isNone, summary } from '../../services/profile-view.ts';
import { USE_COMMAND } from './keys.ts';
import { USE_TEXT as TEXT } from './text.ts';

function requireMap(): string {
  const id = context.currentMap();
  if (!id) throw new Error(TEXT.noMap);
  return id;
}

function use(args: readonly string[]): void {
  const [name, given] = args;
  if (!name || args.length > USE_MAX_ARGUMENTS) throw new Error(TEXT.useUsage);
  const id = given || requireMap();
  const was = profiles.of(id);
  if (isNone(name)) {
    profiles.use(id, null);
    print(was ? TEXT.noneNow(id, was) : TEXT.hadNone(id), was ? COLOR.ok : COLOR.notice);
    return;
  }
  const isNew = !profiles.exists(name);
  profiles.use(id, name);
  print(TEXT.usesNow(id, name, isNew, was, summary(profiles.get(name))), COLOR.ok);
}

export const useCommand = Object.freeze({
  parent: COMMAND.name, name: USE_COMMAND.name, usage: TEXT.usage, desc: TEXT.desc, help: { about: TEXT.about, args: TEXT.args, examples: TEXT.examples, see: TEXT.see }, run: use,
});

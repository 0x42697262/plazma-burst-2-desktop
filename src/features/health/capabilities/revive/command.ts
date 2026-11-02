import { CAPABILITY } from '#shared/features/keys.ts';
import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { level, playerFields as fields, playerGame as game, words } from '#console/kernel/game/player-access.ts';
import { ALL_WORD, COMMAND, YOU } from '../../keys.ts';
import { CLIENT_ONLY, TEXT } from './text.ts';
import { cancelLevelFailed, reviveCharacter } from './revive.ts';

type Args = readonly string[];
const hint = (text: string): void => print(text, COLOR.hint);

function reviveAll(): void {
  let count = 0;
  for (let index = 0; index < game.charCount(); index++) {
    const character = game.chars()[index];
    if (!character?.io || !level.isDown(character)) continue;
    try {
      if (reviveCharacter(index, hint)) count++;
    } catch (error) {
      print(TEXT.reviveFailed(index, (error as Error).message), COLOR.error);
    }
  }
  print(count ? TEXT.revivedCount(count) : TEXT.nobodyDown, count ? COLOR.ok : COLOR.notice);
  cancelLevelFailed(hint);
}

function revive(rawArgs: Args): void {
  level.require();
  const { options, rest } = words.options(rawArgs, [ALL_WORD]);
  if (rest.length > 1 || (options.size && rest.length)) throw new Error(TEXT.reviveUsage);
  const word = (rest[0] ?? '').toLowerCase();
  if (options.has(ALL_WORD) || word === ALL_WORD) {
    reviveAll();
    return;
  }
  const me = game.me();
  const index = word ? words.index(word) : me;
  if (index === null) throw new Error(TEXT.reviveUsage);
  const who = index === me ? YOU : level.label(index);
  if (!reviveCharacter(index, hint)) {
    print(TEXT.notDown(words.capitalize(level.be(who))), COLOR.notice);
    return;
  }
  print(TEXT.revived(who, Math.round(game.chars()[index]?.[fields.HP] as number)), COLOR.ok);
  cancelLevelFailed(hint);
}

export const reviveCommand = Object.freeze({ name: COMMAND.revive, capability: CAPABILITY.health.revive, aliases: COMMAND.reviveAliases, usage: TEXT.revive.usage, desc: TEXT.revive.desc, clientOnly: CLIENT_ONLY, help: { about: TEXT.revive.about, args: TEXT.revive.args, examples: TEXT.revive.examples, see: TEXT.revive.see }, run: revive });

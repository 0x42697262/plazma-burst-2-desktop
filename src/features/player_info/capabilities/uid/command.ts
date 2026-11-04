import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { level, playerGame as game } from '#console/kernel/game/player-access.ts';
import { COMMAND } from '../../keys.ts';
import { ALL_WORD, ARGUMENT_JOIN } from './keys.ts';
import { TEXT } from './text.ts';
import { characterUids } from './uids.ts';

function line(uids: readonly (string | null)[], index: number): string {
  const label = level.label(index);
  if (index >= uids.length) return TEXT.notInMap(label, uids.length);
  const uid = uids[index];
  return uid ? TEXT.row(label, uid) : TEXT.noUid(label, index);
}

function uid(args: string[]): void {
  level.require();
  const text = game.mapText();
  if (typeof text !== 'string' || !text) throw new Error(TEXT.noMap);
  const uids = characterUids(text);
  const query = args.join(ARGUMENT_JOIN).trim();
  if (query.toLowerCase() === ALL_WORD) {
    for (let index = 0; index < game.charCount(); index++) if (level.at(index)) print(line(uids, index), index === game.me() ? COLOR.ok : undefined);
    return;
  }
  print(line(uids, query ? level.resolve(query) : game.me()), COLOR.ok);
}

export const uidCommand = Object.freeze({
  name: COMMAND.uid,
  aliases: COMMAND.uidAliases,
  usage: TEXT.uid.usage,
  desc: TEXT.uid.desc,
  help: { about: TEXT.uid.about, args: TEXT.uid.args, examples: TEXT.uid.examples, see: TEXT.uid.see },
  run: uid,
});

import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { game } from '#console/kernel/game/bindings.ts';
import { stringOf } from '#kernel/text/text-of.ts';
import { ISO_MINUTE_LENGTH } from '../../constants.ts';
import { COMMAND, ENTRY_COMMAND, MINUTE_TIME_END, VIEW, VPN_FIELD } from '../../keys.ts';
import { askList } from '../../adapters/lobby.ts';
import { keepEntry, seenEntries, type SeenEntry } from '../../adapters/entry-store.ts';
import { durationText } from '../../domain/reply.ts';
import { entryOf, sharedWith, type Entry } from '../../domain/entry.ts';
import { TEXT } from './text.ts';

const minuteOf = (time: number): string => new Date(time).toISOString().slice(0, ISO_MINUTE_LENGTH).replace(MINUTE_TIME_END, '');

function vpnFlag(): string {
  const account = (game as unknown as { myAccount(): unknown }).myAccount();
  if (!account || typeof account !== 'object') return TEXT.noValue;
  return stringOf((account as Record<string, unknown>)[VPN_FIELD] ?? TEXT.noValue);
}

function seenLine(now: Entry, earlier: SeenEntry): string {
  const ago = durationText(Date.now() - earlier.at);
  const shared = sharedWith(now, { tag: earlier.tag, relations: earlier.starts.length, oldest: null, starts: earlier.starts });
  if (now.tag !== null && now.tag === earlier.tag) return TEXT.seenSame(ago, earlier.reputation);
  if (shared) return TEXT.seenShared(ago, earlier.tag ?? TEXT.noTagShort, shared, now.relations, earlier.reputation);
  return TEXT.seenOther(ago, earlier.tag ?? TEXT.noTagShort, earlier.reputation);
}

function entry(args: readonly string[]): Promise<void> {
  if (args.length) throw new Error(TEXT.usageError);
  print(TEXT.asking, COLOR.hint);
  return askList(VIEW.relations)
    .then(({ rows, own }) => {
      const found = entryOf(rows);
      const reputation = stringOf(own?.reputation ?? TEXT.noValue);
      if (found.tag !== null && found.oldest !== null) print(TEXT.tag(found.tag, found.relations, minuteOf(found.oldest)), COLOR.title);
      else print(TEXT.noTag, COLOR.notice);
      print(TEXT.reputation(reputation));
      print(TEXT.vpn(vpnFlag()));
      const earlier = seenEntries();
      print(TEXT.seenTitle, COLOR.title);
      if (!earlier.length) print(TEXT.seenNone, COLOR.muted);
      for (const seen of earlier) print(seenLine(found, seen));
      keepEntry({ at: Date.now(), tag: found.tag, starts: found.starts, reputation });
    })
    .catch((error: unknown) => { print((error as Error).message, COLOR.error); });
}

export const entryCommand = Object.freeze({
  parent: COMMAND.name,
  name: ENTRY_COMMAND.name,
  aliases: ENTRY_COMMAND.aliases,
  usage: TEXT.usage,
  desc: TEXT.desc,
  help: { about: TEXT.about, examples: TEXT.examples },
  run: entry,
});

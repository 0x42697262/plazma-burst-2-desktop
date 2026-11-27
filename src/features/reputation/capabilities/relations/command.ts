import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { stringOf } from '#kernel/text/text-of.ts';
import { COMMAND, RELATIONS_COMMAND, VIEW } from '../../keys.ts';
import { TEXT } from './text.ts';
import { askList } from '../../adapters/lobby.ts';
import { durationText, relationOf, type Relation } from '../../domain/reply.ts';

const deltaText = (delta: unknown): string => (typeof delta === 'number' && delta > 0 ? TEXT.positive(String(delta)) : stringOf(delta ?? TEXT.noValue));

function stateText(relation: Relation): string {
  const since = durationText(relation.since);
  if (!relation.active) return TEXT.ended(since);
  return relation.until >= 0 ? TEXT.active(since, durationText(relation.until)) : TEXT.activeEnded(since, durationText(relation.until));
}

function relations(args: readonly string[]): Promise<void> {
  if (args.length) throw new Error(TEXT.usageError);
  print(TEXT.asking, COLOR.hint);
  return askList(VIEW.relations)
    .then(({ rows }) => {
      const found = rows.map(relationOf).filter((relation): relation is Relation => relation !== null);
      if (!found.length) {
        print(TEXT.none, COLOR.notice);
        return;
      }
      print(TEXT.title(found.length), COLOR.title);
      for (const relation of found) {
        print(TEXT.row(relation.fit ? TEXT.fit : TEXT.unfit, relation.from, relation.to, deltaText(relation.delta), stateText(relation)),
          relation.active ? (relation.fit ? COLOR.ok : COLOR.warn) : COLOR.muted);
      }
    })
    .catch((error: unknown) => { print((error as Error).message, COLOR.error); });
}

export const relationsCommand = Object.freeze({
  parent: COMMAND.name,
  name: RELATIONS_COMMAND.name,
  aliases: RELATIONS_COMMAND.aliases,
  usage: TEXT.usage,
  desc: TEXT.desc,
  help: { about: TEXT.about, examples: TEXT.examples },
  run: relations,
});

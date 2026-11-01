import { print } from '../../../../desktop/dev/console/ui/log.js';
import { COLOR } from '#console/kernel/core/keys.ts';
import { plural } from '#console/kernel/core/words.ts';
import { takeOptions, oneOf } from '#console/kernel/core/args.ts';
import { DISTANCE_WIDTH, NAME_WIDTH } from '../constants.ts';
import { COMMAND, CHARS_HINT, NAME_LIST_SEPARATOR, OLD_WORDS, OPTION, OPTION_PREFIX, TRACE_KIND, TRACE_SIDE, WORD_SEPARATOR } from '../keys.ts';
import { TEXT } from '../text.ts';
import type { GameCharacters } from '../adapters/game-characters.ts';
import type { TraceGroup, Tracer } from '../services/tracer.ts';

const KINDS = [OPTION.players, OPTION.npc];
const SIDES = [OPTION.team, OPTION.enemies];
const GROUP_OPTIONS = [OPTION.all, ...KINDS, ...SIDES];
const KIND_OF: Readonly<Record<string, TraceGroup['kind']>> = { [OPTION.players]: TRACE_KIND.players, [OPTION.npc]: TRACE_KIND.npc };
const SIDE_OF: Readonly<Record<string, TraceGroup['side']>> = { [OPTION.team]: TRACE_SIDE.team, [OPTION.enemies]: TRACE_SIDE.enemies };

const pluralText = (count: number, noun: string): string => plural(count, noun);
const pickOne = (options: Set<string>, names: string[]): string | undefined => (oneOf as (options: Set<string>, names: string[]) => string | undefined)(options, names);

export const groupOptions = ({ kind, side }: TraceGroup): string => [kind, side].filter(Boolean).map((option) => OPTION_PREFIX + String(option)).join(WORD_SEPARATOR) || OPTION_PREFIX + OPTION.all;

export function groupText({ kind, side }: TraceGroup): string {
  if (!kind && !side) return TEXT.everyoneElse;
  return TEXT.group(kind ? TEXT.kind[kind] ?? '' : TEXT.everyone, side ? TEXT.side[side] ?? '' : '');
}

export function createTraceCommand(tracer: Tracer, characters: GameCharacters) {
  function targets(args: readonly string[]): [number, boolean][] {
    const text = args.join(WORD_SEPARATOR);
    const words = (text.includes(NAME_LIST_SEPARATOR) ? text.split(NAME_LIST_SEPARATOR) : [...args]).map((word) => word.trim()).filter(Boolean);
    return words.map((word) => {
      let index: number;
      try {
        index = characters.resolve(word);
      } catch (error) {
        const meant = OLD_WORDS[word.toLowerCase()];
        if (!meant) throw error;
        throw new Error(TEXT.oldWord((error as Error).message.replace(CHARS_HINT, ''), meant), { cause: error });
      }
      if (index === characters.me()) throw new Error(TEXT.thatIsYou);
      return [index, characters.isIndexWord(word)];
    });
  }

  function status(): void {
    const now = tracer.tracedNow();
    const group = tracer.group();
    if (!now.length) {
      print(group ? TEXT.groupNobody(groupText(group)) : TEXT.nobody, COLOR.notice);
      return;
    }
    print(TEXT.statusTitle(pluralText(now.length, TEXT.character), group ? groupText(group) : null), COLOR.title);
    for (const index of now) print(TEXT.statusRow(characters.label(index).padEnd(NAME_WIDTH), TEXT.distance(tracer.distanceTo(index)).padEnd(DISTANCE_WIDTH), tracer.isPickedBySlot(index)));
  }

  function stop(rest: readonly string[], options: Set<string>): void {
    const also = GROUP_OPTIONS.find((option) => options.has(option));
    if (also) throw new Error(TEXT.offTogether(also));
    if (!rest.length) {
      tracer.off();
      print(TEXT.off, COLOR.ok);
      return;
    }
    characters.requireLevel();
    for (const [index, bySlot] of targets(rest)) {
      tracer.remove(index, bySlot);
      print(TEXT.stopped(characters.label(index)), COLOR.ok);
    }
  }

  function run(args: readonly string[]): void {
    const { options, rest } = takeOptions(args, Object.values(OPTION)) as { options: Set<string>; rest: string[] };
    const kind = pickOne(options, KINDS);
    const side = pickOne(options, SIDES);
    const isGroup = GROUP_OPTIONS.some((option) => options.has(option));
    if (options.has(OPTION.off)) {
      stop(rest, options);
      return;
    }
    characters.requireLevel();
    if (!isGroup && !rest.length) {
      status();
      return;
    }
    const picked = rest.length ? targets(rest) : [];
    if (isGroup) tracer.setGroup({ kind: kind ? KIND_OF[kind] ?? null : null, side: side ? SIDE_OF[side] ?? null : null });
    if (picked.length) tracer.add(picked);
    const named = picked.map(([index, bySlot]) => TEXT.named(bySlot, characters.label(index), tracer.distanceTo(index))).join(TEXT.namedSeparator);
    const group = tracer.group();
    if (!isGroup || !group) {
      print(TEXT.tracing(named), COLOR.ok);
      return;
    }
    print(TEXT.tracingGroup(groupText(group), named, pluralText(tracer.tracedNow().length, TEXT.character)), COLOR.ok);
  }

  return Object.freeze({
    name: COMMAND.name,
    aliases: COMMAND.aliases,
    usage: TEXT.usage,
    desc: TEXT.description,
    help: { about: TEXT.about, args: TEXT.args, examples: TEXT.examples, notes: TEXT.notes, see: TEXT.see },
    run,
  });
}

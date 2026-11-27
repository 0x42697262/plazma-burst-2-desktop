import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { stringOf } from '#kernel/text/text-of.ts';
import { level, playerGame as game } from '#console/kernel/game/player-access.ts';
import { NAME_WIDTH, NUMBER_WIDTH, SKILL_DECIMALS, SLOT_WIDTH } from '../../constants.ts';
import { COMMAND, PLAYERS_COMMAND } from '../../keys.ts';
import { TEXT } from './text.ts';

const shown = (value: unknown): string => (value === undefined || value === null || value === '' ? TEXT.noValue : stringOf(value));
const skillText = (value: unknown): string => (typeof value === 'number' ? value.toFixed(SKILL_DECIMALS) : shown(value));

function players(args: readonly string[]): void {
  if (args.length) throw new Error(TEXT.usageError);
  level.require();
  if (!game.isMP()) throw new Error(TEXT.notInMatch);
  const me = game.me();
  const characters = game.chars();
  const bySlot = game.playersBySlot() ?? [];
  const slots = Math.max(game.charCount(), bySlot.length);
  for (let index = 0; index < slots; index++) {
    const character = bySlot[index] ?? characters[index];
    if (!character?.io) continue;
    print(TEXT.row(
      String(index).padEnd(SLOT_WIDTH), shown(character.nickname).padEnd(NAME_WIDTH), shown(character.reputation).padStart(NUMBER_WIDTH),
      skillText(character.skill), index === me ? TEXT.youTag : '',
    ), index === me ? COLOR.ok : undefined);
  }
}

export const playersCommand = Object.freeze({
  parent: COMMAND.name,
  name: PLAYERS_COMMAND.name,
  aliases: PLAYERS_COMMAND.aliases,
  usage: TEXT.usage,
  desc: TEXT.desc,
  help: { about: TEXT.about, examples: TEXT.examples, see: TEXT.see },
  run: players,
});

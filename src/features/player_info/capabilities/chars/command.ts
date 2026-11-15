import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { level, playerFields as fields, playerGame as game } from '#console/kernel/game/player-access.ts';
import { DISTANCE_WIDTH, HP_WIDTH, INDEX_WIDTH, NICKNAME_WIDTH } from '../../constants.ts';
import { COMMAND } from '../../keys.ts';
import { parseFilters, passes, teamLabel } from './filters.ts';
import { ARGUMENT_JOIN, KIND } from './keys.ts';
import { TEXT } from './text.ts';

function listCharacters(args: readonly string[], fixedKind: string | null): void {
  level.require();
  const teamNames = game.teamNames();
  const filter = parseFilters(args, teamNames, fixedKind);
  const list = game.chars();
  const me = game.me();
  const mine = level.player();
  const shown: number[] = [];
  for (let index = 0; index < game.charCount(); index++) {
    const character = list[index];
    if (character?.io && passes(filter, character.team, !!character[fields.HUMAN])) shown.push(index);
  }
  if (!shown.length) {
    print(TEXT.noneMatch([fixedKind, ...args].filter(Boolean).join(ARGUMENT_JOIN)));
    return;
  }
  const teamWidth = Math.max(...shown.map((index) => teamLabel(list[index]?.team, teamNames).length));
  for (const index of shown) {
    const character = list[index];
    if (!character) continue;
    const hp = character[fields.HP] as number;
    const distance = Math.round(Math.hypot(character.x - mine.x, character.y - mine.y));
    const tag = index === me ? TEXT.youTag : character.team === mine.team ? TEXT.allyTag : TEXT.enemyTag;
    print(TEXT.charRow(
      String(index).padEnd(INDEX_WIDTH), (typeof character.nickname === 'string' && character.nickname ? character.nickname : TEXT.noNickname).padEnd(NICKNAME_WIDTH),
      teamLabel(character.team, teamNames).padEnd(teamWidth),
      TEXT.hpOf(Math.round(hp), Math.round(character[fields.MAX_HP] as number)).padEnd(HP_WIDTH), hp > 0 ? TEXT.alive : TEXT.deadState, String(distance).padStart(DISTANCE_WIDTH), tag,
    ), index === me ? COLOR.ok : undefined);
  }
}

const helpOf = (text: typeof TEXT.chars | typeof TEXT.players) => ({ about: text.about, args: text.args, examples: text.examples, see: text.see });

export const charsCommand = Object.freeze({
  name: COMMAND.chars, usage: TEXT.chars.usage, desc: TEXT.chars.desc, help: helpOf(TEXT.chars),
  run: (args: string[]): void => { listCharacters(args, null); },
});

export const playersCommand = Object.freeze({
  name: COMMAND.players, usage: TEXT.players.usage, desc: TEXT.players.desc, help: helpOf(TEXT.players),
  run: (args: string[]): void => { listCharacters(args, KIND.players); },
});

export const botsCommand = Object.freeze({
  name: COMMAND.bots, usage: TEXT.bots.usage, desc: TEXT.bots.desc, help: helpOf(TEXT.bots),
  run: (args: string[]): void => { listCharacters(args, KIND.bots); },
});

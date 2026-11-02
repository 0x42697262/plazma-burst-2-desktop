import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { level, playerFields as fields, playerGame as game } from '#console/kernel/game/player-access.ts';
import { DISTANCE_WIDTH, HP_WIDTH, INDEX_WIDTH, NICKNAME_WIDTH, TEAM_WIDTH } from '../../constants.ts';
import { COMMAND } from '../../keys.ts';
import { TEXT } from './text.ts';

function chars(): void {
  level.require();
  const list = game.chars();
  const me = game.me();
  const mine = level.player();
  for (let index = 0; index < game.charCount(); index++) {
    const character = list[index];
    if (!character?.io) continue;
    const hp = character[fields.HP] as number;
    const distance = Math.round(Math.hypot(character.x - mine.x, character.y - mine.y));
    const tag = index === me ? TEXT.youTag : character.team === mine.team ? TEXT.allyTag : TEXT.enemyTag;
    print(TEXT.charRow(
      String(index).padEnd(INDEX_WIDTH), (typeof character.nickname === 'string' && character.nickname ? character.nickname : TEXT.noNickname).padEnd(NICKNAME_WIDTH), String(character.team).padEnd(TEAM_WIDTH),
      TEXT.hpOf(Math.round(hp), Math.round(character[fields.MAX_HP] as number)).padEnd(HP_WIDTH), hp > 0 ? TEXT.alive : TEXT.deadState, String(distance).padStart(DISTANCE_WIDTH), tag,
    ), index === me ? COLOR.ok : undefined);
  }
}

export const charsCommand = Object.freeze({ name: COMMAND.chars, aliases: COMMAND.charsAliases, usage: TEXT.chars.usage, desc: TEXT.chars.desc, help: { about: TEXT.chars.about, see: TEXT.chars.see }, run: chars });

import { print } from '#console/kernel/ui/log.ts';
import { level, playerFields as fields, playerGame as game } from '#console/kernel/game/player-access.ts';
import { COMMAND } from '../../keys.ts';
import { TEXT } from './text.ts';

function pos(): void {
  level.require();
  const character = level.player();
  const point = character[fields.REF_PT] as number;
  print(TEXT.position(Math.round(game.ptX()[point] ?? 0), Math.round(game.ptY()[point] ?? 0), Math.round(character.tarx), Math.round(character.tary)));
}

export const posCommand = Object.freeze({ name: COMMAND.pos, aliases: COMMAND.posAliases, usage: TEXT.pos.usage, desc: TEXT.pos.desc, help: { about: TEXT.pos.about, see: TEXT.pos.see }, run: pos });

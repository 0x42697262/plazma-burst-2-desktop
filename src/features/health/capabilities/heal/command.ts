import { CAPABILITY } from '#shared/features/keys.ts';
import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { level, playerFields as fields } from '#console/kernel/game/player-access.ts';
import { COMMAND } from '../../keys.ts';
import { CLIENT_ONLY, TEXT } from './text.ts';

function heal(): void {
  const character = level.player();
  level.require();
  if (level.isDown(character)) throw new Error(TEXT.down);
  character[fields.HP] = character[fields.MAX_HP];
  print(TEXT.healed(character[fields.MAX_HP]), COLOR.ok);
}

export const healCommand = Object.freeze({ name: COMMAND.heal, capability: CAPABILITY.health.heal, usage: TEXT.heal.usage, desc: TEXT.heal.desc, clientOnly: CLIENT_ONLY, help: { about: TEXT.heal.about, see: TEXT.heal.see }, run: heal });

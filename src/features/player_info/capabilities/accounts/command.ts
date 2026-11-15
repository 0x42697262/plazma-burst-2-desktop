import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { level, playerFields as fields, playerGame as game } from '#console/kernel/game/player-access.ts';
import { AUTH_ID_WIDTH, INDEX_WIDTH, LOGIN_WIDTH, NICKNAME_WIDTH } from '../../constants.ts';
import { COMMAND } from '../../keys.ts';
import { TEXT } from './text.ts';

const shown = (value: unknown, missing: string): string => {
  if (typeof value === 'string' && value) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return missing;
};

function tagsOf(index: number, me: number, character: Record<string, unknown>): string {
  const tags = [index === me ? TEXT.youTag : '', character[fields.SPECTATOR] ? TEXT.spectatorTag : ''];
  return tags.filter(Boolean).join('');
}

function accounts(): void {
  level.require();
  if (!game.isMP()) throw new Error(TEXT.notInMatch);
  const me = game.me();
  const characters = game.chars();
  const bySlot = game.playersBySlot() ?? [];
  const slots = Math.max(game.charCount(), bySlot.length);
  for (let index = 0; index < slots; index++) {
    const character = bySlot[index] ?? characters[index];
    if (!character?.io) continue;
    const hasAccount = !!character[fields.HUMAN];
    print(TEXT.accountRow(
      String(index).padEnd(INDEX_WIDTH),
      shown(character.nickname, TEXT.noValue).padEnd(NICKNAME_WIDTH),
      (hasAccount ? shown(character[fields.LOGIN], TEXT.noValue) : TEXT.noValue).padEnd(LOGIN_WIDTH),
      (hasAccount ? shown(character[fields.AUTH_ID], TEXT.notSynced) : TEXT.noValue).padStart(AUTH_ID_WIDTH),
      tagsOf(index, me, character),
    ), index === me ? COLOR.ok : undefined);
  }
}

export const accountsCommand = Object.freeze({
  name: COMMAND.accounts, aliases: COMMAND.accountsAliases, usage: TEXT.accounts.usage, desc: TEXT.accounts.desc,
  help: { about: TEXT.accounts.about, see: TEXT.accounts.see }, run: accounts,
});

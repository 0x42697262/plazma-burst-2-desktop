import { stringOf } from '#kernel/text/text-of.ts';
import { parseIndex } from '../core/words.ts';
import { BODY_MIDDLE, CHARACTER_SUFFIX_WORDS } from './constants.ts';
import { PLAYER_WORD } from './keys.ts';
import { TEXT } from './text.ts';
import { GAME_FIELDS } from './fields.ts';
import { game } from './bindings.ts';
import type { Character } from './types.ts';

export { BODY_MIDDLE };
export const LEVEL_REQUIRED = TEXT.levelRequired;

export type Target = { p: Character; i: number; who: string };

export const player = (): Character | null => {
  const characters = game.chars();
  return characters ? characters[game.me()] ?? null : null;
};

export function isActive(): boolean {
  if (!game.inLevelFrame()) return false;
  const current = player();
  return !!current && typeof current === 'object' && typeof current[GAME_FIELDS.HP] === 'number';
}

export function requireLevel(): void {
  if (!isActive()) throw new Error(LEVEL_REQUIRED);
}

export const noCharacter = (index: number): Error => new Error(TEXT.noCharacter(index));

export const isDown = (character: Character | null | undefined): boolean => !!character
  && (character[GAME_FIELDS.DEAD] === true || character[GAME_FIELDS.DYING] === true || !(character[GAME_FIELDS.HP] > 0));

export function charAt(index: number): Character | null {
  const character = game.chars()[index];
  return character?.io && index < game.charCount() ? character : null;
}

export const charLabel = (index: number, character: Character | null | undefined = game.chars()[index]): string => TEXT.charLabel(index, character?.nickname ?? '');

export const be = (who: string): string => (who === PLAYER_WORD ? TEXT.youAre : TEXT.isWho(who));
export const have = (who: string): string => (who === PLAYER_WORD ? TEXT.youHave : TEXT.hasWho(who));

export function targetChar(index?: number): Target {
  requireLevel();
  const me = game.me();
  const current = player();
  if ((index === undefined || index === me) && current) return { p: current, i: me, who: PLAYER_WORD };
  if (game.isMP()) throw new Error(TEXT.othersSinglePlayer);
  const target = index === undefined ? null : charAt(index);
  if (!target || index === undefined) throw noCharacter(index ?? me);
  return { p: target, i: index, who: charLabel(index, target) };
}

export function resolveChar(query: string): number {
  const characters = game.chars();
  const alive: number[] = [];
  for (let index = 0; index < game.charCount(); index++) if (characters[index]?.io) alive.push(index);
  const wanted = parseIndex(query);
  if (wanted !== null) {
    if (!alive.includes(wanted)) throw noCharacter(wanted);
    return wanted;
  }
  const lowered = query.toLowerCase();
  const nickname = (index: number): string => stringOf(characters[index]?.nickname || '').toLowerCase();
  const exact = alive.filter((index) => nickname(index) === lowered);
  const hits = exact.length ? exact : alive.filter((index) => nickname(index).includes(lowered));
  const [onlyHit] = hits;
  if (hits.length === 1 && onlyHit !== undefined) return onlyHit;
  if (!hits.length) throw new Error(TEXT.noCharacterNamed(query));
  const matches = hits.map((index) => TEXT.characterMatch(index, stringOf(characters[index]?.nickname))).join(TEXT.matchSeparator);
  throw new Error(TEXT.ambiguousCharacter(query, hits.length, matches));
}

export function takeCharSuffix(args: string[], word: string, usage: string): { args: string[]; target: number | undefined } {
  const at = args.findIndex((arg) => arg.toLowerCase() === word);
  if (at === -1) return { args, target: undefined };
  const target = parseIndex(args[at + 1]);
  if (target === null || args.length !== at + CHARACTER_SUFFIX_WORDS) throw new Error(usage);
  return { args: args.slice(0, at), target };
}

export function currentMapId(): string | null {
  const id = (game.isMP() && game.matchMapId()) || game.mapId();
  return id === undefined || id === null || id === '' ? null : stringOf(id);
}

import { game } from '#console/kernel/game/bindings.ts';
import { GAME_FIELDS } from '#console/kernel/game/fields.ts';
import { movePlayerTo } from '#console/kernel/game/teleport.ts';
import { player, isActive, requireLevel, isDown, charAt, charLabel, be, noCharacter, resolveChar } from '#console/kernel/game/level.ts';
import { KEY } from '#console/kernel/state/schema.ts';
import { settings, binds } from '#console/kernel/state/store.ts';
import { hpBonusAppliedTo } from '#console/kernel/overrides/max-hp.ts';
import { setKey, unsetKey, runKey } from '#console/kernel/commands/settings.ts';
import { takeOptions } from '#console/kernel/core/args.ts';
import { isNumberText, parseIndex, capitalize } from '#console/kernel/core/words.ts';

export type Character = { x: number; y: number; io?: unknown; team?: unknown; nickname?: unknown; tarx: number; tary: number; [field: string]: unknown };
type Fade = { alpha: number; visible: boolean };

type PlayerBindings = {
  me(): number; chars(): (Character | null)[]; charCount(): number; isMP(): boolean;
  updateBody(index: number): void; healChar(index: number, character: Character, power: number): void;
  levelState(): string; setLevelState(state: string): void; setFailText(text: string): void;
  fadeOverlay(): Fade | null; isRunning(): boolean; setRunning(running: boolean): void;
  ptX(): number[]; ptY(): number[];
};
type Fields = {
  HP: string; MAX_HP: string; REF_PT: string;
  HEAD_HP: string; HEAD_OFF: string; FACE_HP: string; FACE_GONE: string; LEGS_HP: string; LEGS_BROKEN: string; ARMS_HP: string; ARMS_BROKEN: string;
};
type Keys = { MAX_HP: string; HP_BONUS: string; HP_BONUS_PCT: string };
type Settings = { has(key: string): boolean; get(key: string): unknown; effective(key: string): unknown };
type Options = { options: Set<string>; rest: string[]; literal: boolean };

export const playerGame = game as unknown as PlayerBindings;
export const playerFields = GAME_FIELDS as unknown as Fields;
export const settingKeys = KEY as unknown as Keys;
export const playerSettings = settings as unknown as Settings;

export const level = {
  player: (): Character => player() as unknown as Character,
  isActive: (): boolean => isActive(),
  require: (): void => { requireLevel(); },
  isDown: (character: Character | null): boolean => (isDown as (character: Character | null) => boolean)(character),
  at: (index: number): Character | null => (charAt as (index: number) => Character | null)(index),
  label: (index: number, character?: Character): string => (charLabel as (index: number, character?: Character) => string)(index, character),
  be: (who: string): string => be(who),
  noCharacter: (index: number): Error => noCharacter(index),
  resolve: (word: string): number => resolveChar(word),
  moveTo: (targetX: number, targetY: number): void => { movePlayerTo(targetX, targetY); },
};

export const hpBonus = {
  appliedTo: (character: Character): number => (hpBonusAppliedTo as (character: Character) => number)(character),
};

export const keySetting = {
  set: (key: string, value: unknown): void => { setKey(key, value); },
  unset: (key: string, note: string): void => { (unsetKey as (key: string, note: string) => void)(key, note); },
  run: (key: string, args: readonly string[]): void => { runKey(key, args); },
};

export const words = {
  options: (args: readonly string[], names: readonly string[]): Options => takeOptions(args, names),
  isNumber: (word: string): boolean => (isNumberText as (word: string) => boolean)(word),
  index: (word: string): number | null => (parseIndex as (word: string) => number | null)(word),
  capitalize: (text: string): string => capitalize(text),
};

export const boundToTp = (command: string): string[] => (binds as unknown as { boundTo(command: string): string[] }).boundTo(command);

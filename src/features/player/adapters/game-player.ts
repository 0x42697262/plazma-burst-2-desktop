import { game } from '../../../../desktop/dev/console/game/bindings.js';
import { F } from '../../../../desktop/dev/console/game/fields.js';
import { movePlayerTo } from '../../../../desktop/dev/console/game/teleport.js';
import { player, isActive, requireLevel, isDown, charAt, charLabel, be, noCharacter, resolveChar } from '../../../../desktop/dev/console/game/level.js';
import { KEY } from '#console/kernel/state/schema.ts';
import { settings, binds } from '#console/kernel/state/store.ts';
import { hpBonusFor, hpBonusAppliedTo } from '../../../../desktop/dev/console/overrides/frame.js';
import { setKey, unsetKey, runKey } from '../../../../desktop/dev/console/commands/settings.js';
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
export const playerFields = F as unknown as Fields;
export const settingKeys = KEY as unknown as Keys;
export const playerSettings = settings as unknown as Settings;

export const level = {
  player: (): Character => (player as () => Character)(),
  isActive: (): boolean => isActive(),
  require: (): void => { requireLevel(); },
  isDown: (character: Character | null): boolean => (isDown as (character: Character | null) => boolean)(character),
  at: (index: number): Character | null => (charAt as (index: number) => Character | null)(index),
  label: (index: number, character?: Character): string => (charLabel as (index: number, character?: Character) => string)(index, character),
  be: (who: string): string => (be as (who: string) => string)(who),
  noCharacter: (index: number): Error => (noCharacter as (index: number) => Error)(index),
  resolve: (word: string): number => (resolveChar as (word: string) => number)(word),
  moveTo: (targetX: number, targetY: number): void => { (movePlayerTo as (targetX: number, targetY: number) => void)(targetX, targetY); },
};

export const hpBonus = {
  forBase: (base: number): number => (hpBonusFor as (base: number) => number)(base),
  appliedTo: (character: Character): number => (hpBonusAppliedTo as (character: Character) => number)(character),
};

export const keySetting = {
  set: (key: string, value: unknown): void => { (setKey as (key: string, value: unknown) => void)(key, value); },
  unset: (key: string, note: string): void => { (unsetKey as (key: string, note: string) => void)(key, note); },
  run: (key: string, args: readonly string[]): void => { (runKey as (key: string, args: readonly string[]) => void)(key, args); },
};

export const words = {
  options: (args: readonly string[], names: readonly string[]): Options => takeOptions(args, names),
  isNumber: (word: string): boolean => (isNumberText as (word: string) => boolean)(word),
  index: (word: string): number | null => (parseIndex as (word: string) => number | null)(word),
  capitalize: (text: string): string => capitalize(text),
};

export const boundToTp = (command: string): string[] => (binds as unknown as { boundTo(command: string): string[] }).boundTo(command);

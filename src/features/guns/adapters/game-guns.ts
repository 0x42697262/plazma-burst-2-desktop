import { game } from '../../../../desktop/dev/console/game/bindings.js';
import { F, GUN_SLOTS, FIRST_SLOT, LAST_SLOT, EMPTY_SLOT, slotField } from '../../../../desktop/dev/console/game/fields.js';
import { targetChar, takeCharSuffix, be, have } from '../../../../desktop/dev/console/game/level.js';
import { parseIndex, capitalize } from '#console/kernel/core/words.ts';

export type GameCharacter = { x: number; y: number; curwea: number; [field: string]: unknown };
export type GameGun = { model?: string; [field: string]: unknown };
export type Target = { p: GameCharacter; i: number; who: string };

type GunBindings = {
  gunModels(): string[]; gunScripts(): Record<string, unknown>; gunSlotOf(gunClass: string): number | null; gunName(model: string): string | null;
  spawnGun(model: string, options: { x: number; y: number; upg: number; command: number }): GameGun | null;
  refreshChar(index: number): void; guns(): GameGun[];
  ptVelX(): number[]; ptVelY(): number[]; ptX(): number[]; wakePt(point: number): void;
};
type Fields = { HP: string; DEAD: string; G_SLOT: string; INDEX: string; G_FIXED: string; G_PT_A: string; G_PT_B: string; AIM: string; FACING: string };

export const gunBindings = game as unknown as GunBindings;
export const gunFields = F as unknown as Fields;
export const slots = { all: GUN_SLOTS, first: FIRST_SLOT as number, last: LAST_SLOT as number, empty: EMPTY_SLOT as number, field: slotField as (slot: number) => string };

export const characters = {
  target: (index: number | undefined): Target => (targetChar as (index: number | undefined) => Target)(index),
  takeSuffix: (args: readonly string[], word: string, usage: string): { args: string[]; target: number | undefined } => (takeCharSuffix as (args: readonly string[], word: string, usage: string) => { args: string[]; target: number | undefined })(args, word, usage),
  be: (who: string): string => (be as (who: string) => string)(who),
  have: (who: string): string => (have as (who: string) => string)(who),
  index: (word: string): number | null => (parseIndex as (word: string) => number | null)(word),
  capitalize: (text: string): string => capitalize(text),
};

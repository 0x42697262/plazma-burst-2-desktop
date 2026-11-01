import { GAME_WIDTH, GAME_HEIGHT, game } from '../../../../desktop/dev/console/game/bindings.js';
import { F } from '../../../../desktop/dev/console/game/fields.js';
import { player, charAt, isDown, charLabel, BODY_MIDDLE, requireLevel, resolveChar, isActive } from '../../../../desktop/dev/console/game/level.js';
import { setLayer, hasLayer, toScreen, crosshair } from '../../../../desktop/dev/console/ui/overlay.js';
import { drawLabels } from '../../../../desktop/dev/console/ui/labels.js';
import { parseIndex } from '#console/kernel/core/words.ts';

export type Character = { x: number; y: number; team: unknown; login?: unknown; nickname?: unknown; [field: string]: unknown };
export type Transform = Record<string, number>;
export type Layer = ((context: CanvasRenderingContext2D, transform: Transform) => unknown) | null;
type ScreenPoint = { x: number; y: number };
type LabelItem = { x: number; y: number; text: string };

const bindings = game as unknown as { charCount(): number; me(): number };

export const gameCharacters = {
  count: (): number => bindings.charCount(),
  me: (): number => bindings.me(),
  at: (index: number): Character | null => (charAt as (index: number) => Character | null)(index),
  player: (): Character | null => (player as () => Character | null)(),
  isDown: (character: Character): boolean => (isDown as (character: Character) => boolean)(character),
  label: (index: number, character?: Character): string => (charLabel as (index: number, character?: Character) => string)(index, character),
  isHuman: (character: Character): boolean => !!character[(F as { HUMAN: string }).HUMAN],
  bodyMiddle: BODY_MIDDLE as number,
  requireLevel: (): void => { requireLevel(); },
  isLevelActive: (): boolean => isActive(),
  resolve: (word: string): number => (resolveChar as (word: string) => number)(word),
  isIndexWord: (word: string): boolean => (parseIndex as (word: string) => number | null)(word) !== null,
};

export const traceOverlay = {
  width: GAME_WIDTH as number,
  height: GAME_HEIGHT as number,
  setLayer: (name: string, draw: Layer): void => { (setLayer as (name: string, draw: Layer) => void)(name, draw); },
  hasLayer: (name: string): boolean => (hasLayer as (name: string) => boolean)(name),
  toScreen: (transform: Transform, point: ScreenPoint): ScreenPoint => (toScreen as (transform: Transform, point: ScreenPoint) => ScreenPoint)(transform, point),
  crosshair: (transform: Transform): unknown => (crosshair as (transform: Transform) => unknown)(transform),
  drawLabels: (context: CanvasRenderingContext2D, items: LabelItem[], cursor: unknown, bounds: { w: number; h: number }): unknown => (drawLabels as (context: CanvasRenderingContext2D, items: LabelItem[], cursor: unknown, bounds: { w: number; h: number }) => unknown)(context, items, cursor, bounds),
};

export type GameCharacters = typeof gameCharacters;
export type TraceOverlay = typeof traceOverlay;

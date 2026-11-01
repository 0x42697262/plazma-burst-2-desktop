import type { FrameOverride, OverrideContext } from '../../feature-types.ts';
import { game } from '../game/bindings.ts';
import { player, isActive } from '../game/level.ts';
import type { MovingCharacter } from '../game/types.ts';
import { restoreAll } from './force.ts';

let overrides: readonly FrameOverride[] = [];
let wasActive = false;
let previousTick: number | null = null;
let activeChanged: () => void = () => undefined;

export const levelWasActive = (): boolean => wasActive;
export const onActiveChange = (listener: () => void): void => { activeChanged = listener; };
export const useOverrides = (list: readonly FrameOverride[]): void => { overrides = list; };

function cleanupAll(): void {
  for (const override of overrides) override.cleanup();
  restoreAll();
}

export function applyOverrides(): void {
  if (!isActive()) {
    if (wasActive) {
      cleanupAll();
      wasActive = false;
      activeChanged();
    }
    previousTick = null;
    return;
  }
  if (!wasActive) {
    wasActive = true;
    activeChanged();
  }
  const context: OverrideContext = { character: player() as MovingCharacter, running: !!game.isRunning(), tick: previousTick ?? game.playerDt() };
  previousTick = game.playerDt();
  for (const override of overrides) override.apply(context);
}

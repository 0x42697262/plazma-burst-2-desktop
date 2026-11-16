import { FPS_BY_CHOICE, choiceOfFps } from '../constants.ts';
import { LOGIC, PHYSICS, type Logic, type Physics } from '../keys.ts';
import type { FpsChange } from '../domain/words.ts';
import type { GameDisplay } from '../adapters/game-display.ts';

export type FpsState = Readonly<{ fps: number | null; physics: Physics; logic: Logic | null }>;

export function createFps(display: GameDisplay) {
  function state(): FpsState {
    const logic = display.unlimitedLogic();
    return {
      fps: FPS_BY_CHOICE[Number(display.fpsChoice())] ?? null,
      physics: display.lowPhysics() === true ? PHYSICS.low : PHYSICS.high,
      logic: logic === null ? null : logic ? LOGIC.unlimited : LOGIC.match,
    };
  }

  function set(change: FpsChange): { hasLogic: boolean } {
    if (change.fps !== undefined) {
      display.setFpsChoice(choiceOfFps(change.fps));
      display.applyFps();
    }
    if (change.physics !== undefined) {
      display.setLowPhysics(change.physics === PHYSICS.low);
      display.syncPointHistory();
    }
    const hasLogic = change.logic === undefined || display.setUnlimitedLogic(change.logic === LOGIC.unlimited);
    return { hasLogic };
  }

  return Object.freeze({ state, set });
}

export type Fps = ReturnType<typeof createFps>;

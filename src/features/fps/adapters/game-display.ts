import { game } from '#console/kernel/game/bindings.ts';

type DisplayBindings = {
  fpsChoice(): unknown; setFpsChoice(choice: number): void; applyFps(): void;
  lowPhysics(): unknown; setLowPhysics(isLow: boolean): void; syncPointHistory(): void;
  unlimitedLogic(): boolean | null; setUnlimitedLogic(isUnlimited: boolean): boolean;
};

export type GameDisplay = DisplayBindings;
export const gameDisplay: GameDisplay = game;

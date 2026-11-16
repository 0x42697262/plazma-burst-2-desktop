import { game } from '#console/kernel/game/bindings.ts';

export type SweepState = { active: boolean; direction: number };

export const sweep: SweepState = { active: false, direction: 1 };

const mouse = game as unknown as { rereadMouse(): void };

export function setSweeping(active: boolean): void {
  const wasActive = sweep.active;
  sweep.active = active;
  sweep.direction = 1;
  if (wasActive && !active) mouse.rereadMouse();
}

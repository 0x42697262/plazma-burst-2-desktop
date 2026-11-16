import { game } from '#console/kernel/game/bindings.ts';

export type StagePoint = { x: number; y: number };
export type SweepState = { active: boolean; direction: number; pointer: StagePoint | null };

export const sweep: SweepState = { active: false, direction: 1, pointer: null };

const mouse = game as unknown as { setMouse(stageX: number, stageY: number): void };

export function releasePointer(): void {
  const { pointer } = sweep;
  if (!pointer) return;
  sweep.pointer = null;
  mouse.setMouse(pointer.x, pointer.y);
}

export function setSweeping(active: boolean): void {
  sweep.active = active;
  sweep.direction = 1;
  if (!active) releasePointer();
}

import { game } from '#console/kernel/game/bindings.ts';
import { requireLevel, isActive } from '#console/kernel/game/level.ts';
import { zoomHeldBack, refusal } from '#console/kernel/overrides/server-checks.ts';
import { protectionHint } from '#console/kernel/ports/protection.ts';

type CameraBindings = { zoom(): number; setZoom(scale: number): void; inLevelFrame(): boolean };
const bindings = game as unknown as CameraBindings;

export type GameCamera = {
  zoom(): number;
  setZoom(scale: number): void;
  inLevelFrame(): boolean;
  isActive(): boolean;
  requireLevel(): void;
  heldBack(percent: number): string | false;
  refusal(subject: string, why: string): Error;
  bypassHint(): string;
};

export const gameCamera: GameCamera = {
  zoom: () => bindings.zoom(),
  setZoom: (scale) => bindings.setZoom(scale),
  inLevelFrame: () => bindings.inLevelFrame(),
  isActive: () => isActive(),
  requireLevel: () => { requireLevel(); },
  heldBack: (percent) => (zoomHeldBack as (percent: number) => string | false)(percent),
  refusal: (subject, why) => refusal(subject, why),
  bypassHint: protectionHint,
};

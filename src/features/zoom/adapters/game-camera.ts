import { game } from '../../../../desktop/dev/console/game/bindings.js';
import { requireLevel, isActive } from '../../../../desktop/dev/console/game/level.js';
import { zoomHeldBack, refusal, BYPASS_HINT } from '../../../../desktop/dev/console/overrides/server-checks.js';

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
  bypassHint: string;
};

export const gameCamera: GameCamera = {
  zoom: () => bindings.zoom(),
  setZoom: (scale) => bindings.setZoom(scale),
  inLevelFrame: () => bindings.inLevelFrame(),
  isActive: () => (isActive)(),
  requireLevel: () => { (requireLevel)(); },
  heldBack: (percent) => (zoomHeldBack as (percent: number) => string | false)(percent),
  refusal: (subject, why) => (refusal as (subject: string, why: string) => Error)(subject, why),
  bypassHint: BYPASS_HINT,
};

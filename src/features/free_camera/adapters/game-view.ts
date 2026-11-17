import { game } from '#console/kernel/game/bindings.ts';
import { GAME_WIDTH } from '#console/kernel/game/constants.ts';
import { GAME_FIELDS } from '#console/kernel/game/fields.ts';
import { LEVEL_REQUIRED, isActive, player } from '#console/kernel/game/level.ts';
import { REASON, aimWatched, refusal } from '#console/kernel/overrides/server-checks.ts';
import { settings } from '#console/kernel/state/store.ts';
import { SETTING } from '../keys.ts';
import { TEXT } from '../text.ts';
import type { CameraView, Point } from '../services/free-camera.ts';

type ViewBindings = {
  zoom(): number;
  camera(): Point | null;
  setWorldOffset(offsetX: number, offsetY: number): void;
  gameCanvas(): { getBoundingClientRect?(): { width: number } } | null;
};
const bindings = game as unknown as ViewBindings;

function stageScale(): number {
  const width = bindings.gameCanvas()?.getBoundingClientRect?.().width ?? 0;
  return width > 0 ? GAME_WIDTH / width : 1;
}

export const gameView: CameraView = {
  isActive: () => isActive(),
  isAlive: () => Number(player()?.[GAME_FIELDS.HP]) > 0,
  isWatched: () => aimWatched(),
  refusal: () => refusal(TEXT.subject, REASON.aim),
  levelRequired: () => new Error(LEVEL_REQUIRED),
  zoom: () => Number(bindings.zoom()) || 1,
  worldOffset: () => bindings.camera(),
  setWorldOffset: (offsetX, offsetY) => { bindings.setWorldOffset(offsetX, offsetY); },
  stageScale,
  speed: () => Number(settings.effective(SETTING.speed)),
  fastFactor: () => Number(settings.effective(SETTING.fast)),
};

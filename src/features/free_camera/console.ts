import { FEATURE } from '#shared/features/keys.ts';
import type { ConsoleFeature } from '#console/feature-types.ts';
import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { provideKeyHandler, provideKeyUpHandler } from '#console/kernel/ports/input.ts';
import { EVENT, FRAME_HOOK_NAME, SETTINGS } from './keys.ts';
import { gameView } from './adapters/game-view.ts';
import { createFreeCamera } from './services/free-camera.ts';
import { createFreeCameraCommand } from './entry/command.ts';

const camera = createFreeCamera({ view: gameView, now: () => performance.now(), say: (text) => print(text, COLOR.ok), warn: (text) => print(text, COLOR.warn) });

function keepFromGame(event: Event): void {
  event.preventDefault();
  event.stopImmediatePropagation();
}

function start(): void {
  provideKeyHandler((event) => camera.keyDown(event));
  provideKeyUpHandler((event) => { camera.keyUp(event); });
  document.addEventListener(EVENT.mouseDown, (event: MouseEvent) => { if (camera.mouseDown(event)) keepFromGame(event); }, true);
  document.addEventListener(EVENT.mouseMove, (event: MouseEvent) => { camera.mouseMove(event); }, true);
  document.addEventListener(EVENT.mouseUp, (event: MouseEvent) => { if (camera.mouseUp(event)) keepFromGame(event); }, true);
  globalThis.addEventListener(EVENT.blur, () => { camera.releaseAll(); });
}

export const freeCameraConsole: ConsoleFeature = Object.freeze({
  id: FEATURE.freeCamera,
  commands: [createFreeCameraCommand(camera)],
  frame: [{ name: FRAME_HOOK_NAME, run: camera.frame }],
  settings: SETTINGS,
  start,
});

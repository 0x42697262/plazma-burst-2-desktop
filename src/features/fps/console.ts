import { FEATURE } from '#shared/features/keys.ts';
import type { ConsoleFeature } from '#console/feature-types.ts';
import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { gameDisplay } from './adapters/game-display.ts';
import { createFps } from './services/fps.ts';
import { createFpsCommand } from './entry/command.ts';

export const fps = createFps(gameDisplay);

export const fpsConsole: ConsoleFeature = Object.freeze({
  id: FEATURE.fps,
  commands: [createFpsCommand(fps, { say: (text) => print(text, COLOR.ok), warn: (text) => print(text, COLOR.warn) })],
});

import { FEATURE } from '#shared/features/keys.ts';
import type { ConsoleFeature } from '#console/feature-types.ts';
import { print } from '../../../desktop/dev/console/ui/log.js';
import { COLOR } from '#console/kernel/core/keys.ts';
import { FRAME_HOOK_NAME, LIST_SECTION } from './keys.ts';
import { gameCamera } from './adapters/game-camera.ts';
import { createZoom } from './services/zoom.ts';
import { createZoomCommand } from './entry/command.ts';

const zoom = createZoom({ camera: gameCamera, say: (text) => print(text, COLOR.ok), warn: (text) => print(text, COLOR.warn) });

export const zoomConsole: ConsoleFeature = Object.freeze({
  id: FEATURE.zoom,
  commands: [createZoomCommand(zoom)],
  frame: [{ name: FRAME_HOOK_NAME, run: zoom.frame }],
  listSections: {
    [LIST_SECTION]: () => {
      const rows = zoom.listRows();
      return rows && [LIST_SECTION, rows] as const;
    },
  },
});

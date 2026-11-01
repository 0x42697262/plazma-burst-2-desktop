import { FEATURE } from '#shared/features/keys.ts';
import type { ConsoleFeature } from '#console/feature-types.ts';
import { print } from '../../../desktop/dev/console/ui/log.js';
import { COLOR } from '../../../desktop/dev/console/core/colors.js';
import { MAP_ERRORS_SHOWN, MAP_TICK_MS } from './constants.ts';
import { TICK_NAME } from './keys.ts';
import { gameMaps } from './adapters/game-maps.ts';
import { saveMapText, savedMapText } from './adapters/wrapper-client.ts';
import { createMultiplayerCache } from './services/multiplayer-cache.ts';
import { mapsCommand } from './entry/command.ts';

export const multiplayerCache = createMultiplayerCache({
  game: gameMaps,
  save: saveMapText,
  load: savedMapText,
  say: (text, isGood) => print(text, isGood ? COLOR.ok : COLOR.hint),
  warn: (...parts) => console.warn(...parts),
});

export const mapCacheConsole: ConsoleFeature = Object.freeze({
  id: FEATURE.mapCache,
  commands: [mapsCommand],
  ticks: [{ name: TICK_NAME, everyMs: MAP_TICK_MS, errorsShown: MAP_ERRORS_SHOWN, run: multiplayerCache.tick }],
});

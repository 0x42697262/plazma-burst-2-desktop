import { FEATURE } from '#shared/features/keys.ts';
import { consoleFeatureOf } from '#console/feature-types.ts';
import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { MAP_ERRORS_SHOWN, MAP_TICK_MS } from './constants.ts';
import { TICK_NAME } from './keys.ts';
import { gameMaps } from './adapters/game-maps.ts';
import { saveMapText, savedMapText } from './adapters/wrapper-client.ts';
import { createMultiplayerCache } from './services/multiplayer-cache.ts';
import { MAP_CACHE_PARTS } from './capabilities.ts';

export const multiplayerCache = createMultiplayerCache({
  game: gameMaps,
  save: saveMapText,
  load: savedMapText,
  say: (text, isGood) => print(text, isGood ? COLOR.ok : COLOR.hint),
  warn: (...parts) => console.warn(...parts),
});

export const mapCacheConsole = consoleFeatureOf(FEATURE.mapCache, MAP_CACHE_PARTS, {
  ticks: [{ name: TICK_NAME, everyMs: MAP_TICK_MS, errorsShown: MAP_ERRORS_SHOWN, run: multiplayerCache.tick }],
});

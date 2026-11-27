import type { FlagStates } from '#shared/features/types.ts';
import { mapBotServer } from '#features/map_bot/server.ts';
import { webClientServer } from '#features/web_client/server.ts';
import { mapUpdateServer } from '#features/map_update/server.ts';
import type { ServerFeature } from './feature-types.ts';

export const SERVER_FEATURES: readonly ServerFeature[] = Object.freeze([
  mapBotServer,
  webClientServer,
  mapUpdateServer,
]);

export const enabledServerFeatures = (states: FlagStates, features: readonly ServerFeature[] = SERVER_FEATURES): ServerFeature[] => features.filter((feature) => states[feature.id].on);

import type { FlagStates } from '#shared/features/types.ts';
import { mapBotServer } from '#features/map_bot/server.ts';
import { webClientServer } from '#features/web_client/server.ts';
import type { ServerFeature } from './feature-types.ts';

export const SERVER_FEATURES: readonly ServerFeature[] = Object.freeze([
  mapBotServer,
  webClientServer,
]);

export const enabledServerFeatures = (states: FlagStates, features: readonly ServerFeature[] = SERVER_FEATURES): ServerFeature[] => features.filter((feature) => states[feature.id].on);

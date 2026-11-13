import type { FlagStates } from '#shared/features/types.ts';
import type { ServerFeature } from './feature-types.ts';

export const SERVER_FEATURES: readonly ServerFeature[] = Object.freeze([
]);

export const enabledServerFeatures = (states: FlagStates, features: readonly ServerFeature[] = SERVER_FEATURES): ServerFeature[] => features.filter((feature) => states[feature.id].on);

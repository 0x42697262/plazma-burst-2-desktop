import { FEATURE, type FeatureId } from '#shared/features/keys.ts';

export const EVERY_FEATURE = 'all';
export const DEVELOPMENT_EDITION_NAME = 'dev';

export const ALWAYS_WITH: Readonly<Partial<Record<FeatureId, readonly FeatureId[]>>> = Object.freeze({
  [FEATURE.serverList]: Object.freeze([FEATURE.lobbyTaskGuard, FEATURE.certPinning]),
});

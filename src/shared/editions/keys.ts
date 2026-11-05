import { FEATURE, type FeatureId } from '#shared/features/keys.ts';

export const EVERY_FEATURE = 'all';
export const DEVELOPMENT_EDITION_NAME = 'dev';

export const ALWAYS_WITH: Readonly<Partial<Record<FeatureId, readonly FeatureId[]>>> = Object.freeze({
  [FEATURE.serverList]: Object.freeze([FEATURE.lobbyTaskGuard, FEATURE.certPinning]),
});

export const DIAGNOSTIC_FIELD = Object.freeze({ kind: 'kind', client: 'client', appVersion: 'appVersion', edition: 'edition', gameVersion: 'gameVersion', flags: 'flags', error: 'error' });
export type DiagnosticField = typeof DIAGNOSTIC_FIELD[keyof typeof DIAGNOSTIC_FIELD];
export const DIAGNOSTIC_FIELDS = Object.freeze(Object.values(DIAGNOSTIC_FIELD)) as readonly DiagnosticField[];

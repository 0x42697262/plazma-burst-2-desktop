import { FEATURE, type FeatureId } from '#shared/features/keys.ts';
import type { FeatureDefinition } from '#shared/features/types.ts';
import type { Edition } from './types.ts';

export const hiddenFeatures = (edition: Edition): readonly FeatureId[] => (edition.diagnostics?.hidden ? [FEATURE.diagnostics] : []);

export const isHiddenFeature = (edition: Edition, id: FeatureId): boolean => hiddenFeatures(edition).includes(id);

export const visibleCatalog = (catalog: readonly FeatureDefinition[], edition: Edition): readonly FeatureDefinition[] =>
  catalog.filter((definition) => !isHiddenFeature(edition, definition.id));

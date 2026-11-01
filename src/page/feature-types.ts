import type { FeatureId } from '#shared/features/keys.ts';

export type PageFeature = Readonly<{ id: FeatureId; start(): void }>;

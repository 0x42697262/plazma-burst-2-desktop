import { z } from 'zod';
import { isCapabilityId, isFeatureId } from '#shared/features/catalog.ts';
import type { FlagOverrides } from '#shared/features/types.ts';
import { createVersionedFile, type VersionedFile } from '#kernel/persist/versioned.ts';
import { FEATURES_FILE_VERSION } from './constants.ts';

const featuresFileSchema = z.object({ features: z.record(z.string(), z.boolean()) });
export type FeaturesFile = z.infer<typeof featuresFileSchema>;

export const featuresFileStore = (file: string): VersionedFile<FeaturesFile> => createVersionedFile<FeaturesFile>({
  file,
  version: FEATURES_FILE_VERSION,
  schema: featuresFileSchema,
  migrations: { 0: (data) => ({ features: data.features ?? data }) },
});

export type FileOverrides = Readonly<{ overrides: FlagOverrides; capabilityOverrides: Readonly<Record<string, boolean>>; unknownIds: readonly string[] }>;

export function splitKnownFeatures(saved: FeaturesFile | null): FileOverrides {
  const entries = Object.entries(saved?.features ?? {});
  const overrides: FlagOverrides = Object.freeze(Object.fromEntries(entries.filter(([id]) => isFeatureId(id))));
  const capabilityOverrides = Object.freeze(Object.fromEntries(entries.filter(([id]) => isCapabilityId(id))));
  const unknownIds = entries.filter(([id]) => !isFeatureId(id) && !isCapabilityId(id)).map(([id]) => id);
  return Object.freeze({ overrides, capabilityOverrides, unknownIds: Object.freeze(unknownIds) });
}

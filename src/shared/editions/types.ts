import type { FeatureId } from '#shared/features/keys.ts';

export type Edition = Readonly<{
  name: string;
  title: string;
  appId: string;
  features: readonly FeatureId[] | null;
  capabilities: readonly string[] | null;
}>;

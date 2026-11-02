import type { FeatureId } from '#shared/features/keys.ts';

export type Edition = Readonly<{
  name: string;
  title: string;
  appId: string;
  features: readonly FeatureId[] | null;
  capabilities: readonly string[] | null;
}>;

export type DefaultServer = Readonly<{ name: string; address: string; fingerprint: string }>;
export type EditionDefaults = Readonly<{ servers: readonly DefaultServer[]; settings: Readonly<Record<string, unknown>> }>;

import type { FeatureId } from '#shared/features/keys.ts';

export type EditionDiagnosticKey = Readonly<{ kid?: string; key: string }>;
export type EditionDiagnostics = Readonly<{ hidden?: boolean; host?: string; send?: readonly string[]; auto?: boolean; keys?: readonly EditionDiagnosticKey[] }>;

export type Edition = Readonly<{
  name: string;
  title: string;
  appId: string;
  features: readonly FeatureId[] | null;
  capabilities: readonly string[] | null;
  diagnostics?: EditionDiagnostics;
}>;

export type DefaultServer = Readonly<{ name: string; address: string; fingerprint: string }>;
export type EditionDefaults = Readonly<{ servers: readonly DefaultServer[]; settings: Readonly<Record<string, unknown>> }>;

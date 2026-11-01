import type { ClientId, FeatureId, FlagSource, Mode } from './keys.ts';

export type FeatureDefinition = Readonly<{
  id: FeatureId;
  defaultOn: boolean;
  availableIn: readonly Mode[];
  requires: readonly FeatureId[];
  unavailableForClients: readonly ClientId[];
  locked: boolean;
  owner: string;
  description: string;
}>;

export type FlagState = Readonly<{ on: boolean; source: FlagSource; reason: string | null }>;
export type FlagStates = Readonly<Record<FeatureId, FlagState>>;
export type FlagOverrides = Readonly<Partial<Record<FeatureId, boolean>>>;
export type FeatureToggle = Readonly<{ id: string; on: boolean }>;

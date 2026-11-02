import type { FeatureDefinition } from '#shared/features/types.ts';
import type { FeatureId } from '#shared/features/keys.ts';
import { ALWAYS_WITH, EVERY_FEATURE } from '#shared/editions/keys.ts';
import { TEXT } from './text.ts';

export type EditionList = typeof EVERY_FEATURE | readonly string[];
export type ResolvedEdition = Readonly<{
  features: readonly FeatureId[];
  capabilities: readonly string[] | null;
  missing: readonly string[];
  problems: readonly string[];
}>;

type Needs = Readonly<{ id: string; needs: string }>;

function needsOf(catalog: readonly FeatureDefinition[], features: ReadonlySet<string>, capabilities: ReadonlySet<string>): Needs[] {
  const needs: Needs[] = [];
  for (const definition of catalog) {
    if (!features.has(definition.id)) continue;
    for (const required of definition.requires) needs.push({ id: definition.id, needs: required });
    for (const companion of ALWAYS_WITH[definition.id] ?? []) needs.push({ id: definition.id, needs: companion });
    for (const capability of definition.capabilities) {
      if (!capabilities.has(capability.id)) continue;
      for (const required of capability.requires) needs.push({ id: capability.id, needs: required });
    }
  }
  for (const definition of catalog) {
    const isLockedWithItsNeeds = definition.locked && definition.requires.length > 0 && definition.requires.every((required) => features.has(required));
    if (isLockedWithItsNeeds) for (const required of definition.requires) needs.push({ id: required, needs: definition.id });
  }
  return needs;
}

export function resolveEdition(catalog: readonly FeatureDefinition[], listed: EditionList): ResolvedEdition {
  if (listed === EVERY_FEATURE) return Object.freeze({ features: catalog.map((definition) => definition.id), capabilities: null, missing: [], problems: [] });
  const byId = new Map(catalog.map((definition) => [definition.id as string, definition]));
  const capabilityById = new Map(catalog.flatMap((definition) => definition.capabilities).map((capability) => [capability.id, capability]));
  const unknown = listed.filter((id) => !byId.has(id) && !capabilityById.has(id));
  const whole = new Set<string>(listed.filter((id) => byId.has(id)));
  const picked = new Set(listed.filter((id) => capabilityById.has(id)));
  const features = new Set<string>([...whole, ...[...picked].map((id) => capabilityById.get(id)?.feature ?? '')]);
  const capabilities = new Set<string>([
    ...picked,
    ...catalog.filter((definition) => whole.has(definition.id)).flatMap((definition) => definition.capabilities.map((capability) => capability.id)),
  ]);
  const isPresent = (id: string): boolean => (byId.has(id) ? features.has(id) : capabilities.has(id));
  const unmet = needsOf(catalog, features, capabilities).filter(({ needs }) => !isPresent(needs));
  const missing = [...new Set(unmet.map(({ needs }) => needs))];
  const problems = [...unknown.map((id) => TEXT.unknownFeature(id)), ...unmet.map(({ id, needs }) => TEXT.needsListed(id, needs))];
  return Object.freeze({
    features: catalog.map((definition) => definition.id).filter((id) => features.has(id)),
    capabilities: [...capabilityById.keys()].filter((id) => capabilities.has(id)),
    missing,
    problems: [...new Set(problems)],
  });
}

export function withRequirements(catalog: readonly FeatureDefinition[], listed: readonly string[]): string[] {
  let current = [...listed];
  for (;;) {
    const { missing } = resolveEdition(catalog, current);
    if (!missing.length) return current;
    current = [...current, ...missing];
  }
}

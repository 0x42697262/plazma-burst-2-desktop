import type { FeatureDefinition } from '#shared/features/types.ts';
import type { FeatureId } from '#shared/features/keys.ts';
import { ALWAYS_WITH, EVERY_FEATURE } from '#shared/editions/keys.ts';
import { TEXT } from './text.ts';

export type EditionList = typeof EVERY_FEATURE | readonly string[];
export type ResolvedEdition = Readonly<{
  features: readonly FeatureId[];
  capabilities: readonly string[] | null;
  added: readonly string[];
  problems: readonly string[];
}>;

export function resolveEdition(catalog: readonly FeatureDefinition[], listed: EditionList): ResolvedEdition {
  if (listed === EVERY_FEATURE) return Object.freeze({ features: catalog.map((definition) => definition.id), capabilities: null, added: [], problems: [] });
  const byId = new Map(catalog.map((definition) => [definition.id as string, definition]));
  const capabilityById = new Map(catalog.flatMap((definition) => definition.capabilities).map((capability) => [capability.id, capability]));
  const problems = listed.filter((id) => !byId.has(id) && !capabilityById.has(id)).map((id) => TEXT.unknownFeature(id));
  const whole = new Set(listed.filter((id) => byId.has(id)) as FeatureId[]);
  const pickedCapabilities = new Set(listed.filter((id) => capabilityById.has(id)));
  const included = new Set<FeatureId>(whole);
  const added: string[] = [];
  const include = (id: FeatureId, because: string): void => {
    if (included.has(id)) return;
    included.add(id);
    whole.add(id);
    added.push(because);
  };
  const pick = (id: string, because: string): void => {
    if (pickedCapabilities.has(id)) return;
    pickedCapabilities.add(id);
    added.push(because);
  };
  let changed = true;
  while (changed) {
    const sizeBefore = included.size + pickedCapabilities.size;
    for (const id of pickedCapabilities) {
      const capability = capabilityById.get(id);
      if (!capability) continue;
      included.add(capability.feature);
      for (const required of capability.requires) pick(required, TEXT.required(required, id));
    }
    for (const id of [...included]) {
      for (const required of byId.get(id)?.requires ?? []) include(required, TEXT.required(required, id));
      for (const companion of ALWAYS_WITH[id] ?? []) include(companion, TEXT.alwaysWith(companion, id));
    }
    for (const definition of catalog) {
      const isLockedWithItsNeeds = definition.locked && definition.requires.length > 0 && definition.requires.every((required) => included.has(required));
      if (isLockedWithItsNeeds) include(definition.id, TEXT.lockedWith(definition.id, definition.requires));
    }
    changed = included.size + pickedCapabilities.size !== sizeBefore;
  }
  const features = catalog.map((definition) => definition.id).filter((id) => included.has(id));
  const capabilities = catalog
    .filter((definition) => included.has(definition.id))
    .flatMap((definition) => definition.capabilities)
    .map((capability) => capability.id)
    .filter((id) => whole.has(capabilityById.get(id)?.feature as FeatureId) || pickedCapabilities.has(id));
  return Object.freeze({ features, capabilities, added, problems });
}

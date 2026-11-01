import { FLAG_SOURCE, type ClientId, type FeatureId, type FlagSource, type Mode } from '#shared/features/keys.ts';
import type { FeatureDefinition, FeatureToggle, FlagOverrides, FlagState, FlagStates } from '#shared/features/types.ts';
import { TEXT } from './text.ts';

export type ResolveInput = Readonly<{
  catalog: readonly FeatureDefinition[];
  fileOverrides: FlagOverrides;
  fileUnknownIds: readonly string[];
  envToggles: readonly FeatureToggle[];
  mode: Mode;
  client: ClientId;
}>;

export type ResolveResult = Readonly<{ states: FlagStates; problems: readonly string[] }>;

const stateOf = (on: boolean, source: FlagSource, reason: string | null = null): FlagState => Object.freeze({ on, source, reason });

function overrideProblem(definition: FeatureDefinition, on: boolean, where: string): string | null {
  const turnsOffLocked = definition.locked && !on;
  return turnsOffLocked ? TEXT.locked(definition.id, where) : null;
}

function constraintReason(definition: FeatureDefinition, mode: Mode, client: ClientId): string | null {
  if (!definition.availableIn.includes(mode)) return TEXT.notAvailableInMode(mode);
  if (definition.unavailableForClients.includes(client)) return TEXT.notForClient(client);
  return null;
}

export function resolveFlags(input: ResolveInput): ResolveResult {
  const { catalog, fileOverrides, fileUnknownIds, envToggles, mode, client } = input;
  const byId = new Map(catalog.map((definition) => [definition.id, definition]));
  const states = new Map<FeatureId, FlagState>(catalog.map((definition) => [definition.id, stateOf(definition.defaultOn, FLAG_SOURCE.default)]));
  const problems: string[] = fileUnknownIds.map((id) => TEXT.unknownFeature(id, TEXT.sourceFile));

  const applyOverride = (definition: FeatureDefinition, on: boolean, source: FlagSource, where: string): void => {
    const problem = overrideProblem(definition, on, where);
    if (problem) problems.push(problem);
    else states.set(definition.id, stateOf(on, source));
  };

  for (const definition of catalog) {
    const fileValue = fileOverrides[definition.id];
    if (fileValue !== undefined) applyOverride(definition, fileValue, FLAG_SOURCE.file, TEXT.sourceFile);
  }
  for (const toggle of envToggles) {
    const definition = byId.get(toggle.id as FeatureId);
    if (definition) applyOverride(definition, toggle.on, FLAG_SOURCE.env, TEXT.sourceEnv);
    else problems.push(TEXT.unknownFeature(toggle.id, TEXT.sourceEnv));
  }

  for (const definition of catalog) {
    const reason = constraintReason(definition, mode, client);
    if (reason && states.get(definition.id)?.on) states.set(definition.id, stateOf(false, FLAG_SOURCE.constraint, reason));
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const definition of catalog) {
      if (!states.get(definition.id)?.on) continue;
      const missing = definition.requires.find((required) => !states.get(required)?.on);
      if (missing === undefined) continue;
      states.set(definition.id, stateOf(false, FLAG_SOURCE.constraint, TEXT.needs(missing)));
      changed = true;
    }
  }

  return Object.freeze({ states: Object.freeze(Object.fromEntries(states)) as FlagStates, problems: Object.freeze(problems) });
}

export const isOn = (states: FlagStates, id: FeatureId): boolean => states[id].on;

const wasSetExplicitly = (state: FlagState): boolean => state.source === FLAG_SOURCE.file || state.source === FLAG_SOURCE.env;

export const explicitlySet = (catalog: readonly FeatureDefinition[], states: FlagStates): Record<string, string> => Object.fromEntries(
  catalog
    .filter((definition) => wasSetExplicitly(states[definition.id]))
    .map((definition) => [definition.id, TEXT.stateWithSource(states[definition.id].on ? TEXT.on : TEXT.off, states[definition.id].source)]),
);

export const reportLines = (catalog: readonly FeatureDefinition[], states: FlagStates): string[] => [
  TEXT.reportHeader,
  ...catalog.map((definition) => {
    const state = states[definition.id];
    return TEXT.reportLine(definition.id, state.on ? TEXT.on : TEXT.off, state.source, state.reason, definition.description);
  }),
];

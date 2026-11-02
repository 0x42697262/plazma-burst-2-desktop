import { ALL_MODES, CAPABILITY, CLIENT, FEATURE, FEATURE_OWNER, MODE, type ClientId, type FeatureId, type Mode } from './keys.ts';
import { FEATURE_DESCRIPTION } from './text.ts';
import type { CapabilityDefinition, FeatureDefinition } from './types.ts';

type FeatureSpec = Partial<Omit<FeatureDefinition, 'id' | 'owner' | 'description' | 'capabilities'>> & { capabilities?: Readonly<Record<string, readonly string[]>> };

const LOCAL_AND_SERVER: readonly Mode[] = Object.freeze([MODE.local, MODE.server]);
const LOCAL_ONLY: readonly Mode[] = Object.freeze([MODE.local]);
const ONLY_OFFICIAL: readonly ClientId[] = Object.freeze([CLIENT.sadburst]);
const NEEDS_CONSOLE: readonly FeatureId[] = Object.freeze([FEATURE.devConsole]);

const capabilitiesOf = (feature: FeatureId, needs: Readonly<Record<string, readonly string[]>>): CapabilityDefinition[] =>
  Object.entries(needs).map(([id, requires]) => Object.freeze({ id, feature, requires: Object.freeze([...requires]) }));

const noNeeds = (ids: Readonly<Record<string, string>>): Readonly<Record<string, readonly string[]>> => Object.fromEntries(Object.values(ids).map((id) => [id, []]));

const define = (id: FeatureId, { capabilities = {}, ...spec }: FeatureSpec = {}): FeatureDefinition => Object.freeze({
  id,
  defaultOn: true,
  availableIn: ALL_MODES,
  requires: [],
  unavailableForClients: [],
  locked: false,
  owner: FEATURE_OWNER,
  description: FEATURE_DESCRIPTION[id],
  ...spec,
  capabilities: Object.freeze(capabilitiesOf(id, capabilities)),
});

const consoleFeature = (id: FeatureId, spec: FeatureSpec = {}): FeatureDefinition => define(id, { requires: NEEDS_CONSOLE, ...spec });

export const CATALOG: readonly FeatureDefinition[] = Object.freeze([
  define(FEATURE.devConsole),
  consoleFeature(FEATURE.consoleCore, { locked: true }),
  consoleFeature(FEATURE.profiles),
  consoleFeature(FEATURE.teleport),
  consoleFeature(FEATURE.playerInfo, { capabilities: noNeeds(CAPABILITY.playerInfo) }),
  consoleFeature(FEATURE.health, {
    capabilities: { [CAPABILITY.health.god]: [], [CAPABILITY.health.hp]: [], [CAPABILITY.health.heal]: [], [CAPABILITY.health.revive]: [] },
  }),
  consoleFeature(FEATURE.movement, { capabilities: noNeeds(CAPABILITY.movement) }),
  consoleFeature(FEATURE.guns, { capabilities: noNeeds(CAPABILITY.guns) }),
  consoleFeature(FEATURE.binds, { capabilities: noNeeds(CAPABILITY.binds) }),
  consoleFeature(FEATURE.triggers),
  consoleFeature(FEATURE.trace),
  define(FEATURE.mapCache),
  consoleFeature(FEATURE.mapEditor, { requires: [FEATURE.devConsole, FEATURE.mapCache, FEATURE.triggers] }),
  consoleFeature(FEATURE.gameChat, { capabilities: noNeeds(CAPABILITY.gameChat) }),
  consoleFeature(FEATURE.zoom),
  consoleFeature(FEATURE.screenshot, { capabilities: { [CAPABILITY.screenshot.screenshot]: [], [CAPABILITY.screenshot.key]: [CAPABILITY.screenshot.screenshot] } }),
  consoleFeature(FEATURE.netlog),
  consoleFeature(FEATURE.fingerprint, { availableIn: LOCAL_AND_SERVER }),
  define(FEATURE.lobbyTaskGuard, { availableIn: LOCAL_ONLY }),
  consoleFeature(FEATURE.scanBypass, { availableIn: LOCAL_AND_SERVER }),
  consoleFeature(FEATURE.jsEval, { availableIn: LOCAL_AND_SERVER }),
  define(FEATURE.hooks, { unavailableForClients: ONLY_OFFICIAL }),
  define(FEATURE.serverList, { availableIn: LOCAL_ONLY, unavailableForClients: ONLY_OFFICIAL }),
  define(FEATURE.login),
  define(FEATURE.certPinning, { availableIn: LOCAL_ONLY }),
  define(FEATURE.remotePlay, { availableIn: [MODE.remote], unavailableForClients: ONLY_OFFICIAL }),
  define(FEATURE.p2pHost, { availableIn: [MODE.server], unavailableForClients: ONLY_OFFICIAL }),
  define(FEATURE.clientSadburst),
  define(FEATURE.gameSetup),
]);

export const CATALOG_BY_ID: ReadonlyMap<FeatureId, FeatureDefinition> = new Map(CATALOG.map((definition) => [definition.id, definition]));
export const isFeatureId = (value: string): value is FeatureId => CATALOG_BY_ID.has(value as FeatureId);

export const CAPABILITIES: readonly CapabilityDefinition[] = Object.freeze(CATALOG.flatMap((definition) => definition.capabilities));
export const CAPABILITY_BY_ID: ReadonlyMap<string, CapabilityDefinition> = new Map(CAPABILITIES.map((capability) => [capability.id, capability]));
export const isCapabilityId = (value: string): boolean => CAPABILITY_BY_ID.has(value);

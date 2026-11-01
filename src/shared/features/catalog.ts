import { ALL_MODES, CLIENT, FEATURE, FEATURE_OWNER, MODE, type ClientId, type FeatureId, type Mode } from './keys.ts';
import { FEATURE_DESCRIPTION } from './text.ts';
import type { FeatureDefinition } from './types.ts';

type FeatureSpec = Partial<Omit<FeatureDefinition, 'id' | 'owner' | 'description'>>;

const LOCAL_AND_SERVER: readonly Mode[] = Object.freeze([MODE.local, MODE.server]);
const LOCAL_ONLY: readonly Mode[] = Object.freeze([MODE.local]);
const ONLY_OFFICIAL: readonly ClientId[] = Object.freeze([CLIENT.sadburst]);
const NEEDS_CONSOLE: readonly FeatureId[] = Object.freeze([FEATURE.devConsole]);

const define = (id: FeatureId, spec: FeatureSpec = {}): FeatureDefinition => Object.freeze({
  id,
  defaultOn: true,
  availableIn: ALL_MODES,
  requires: [],
  unavailableForClients: [],
  locked: false,
  migrated: false,
  owner: FEATURE_OWNER,
  description: FEATURE_DESCRIPTION[id],
  ...spec,
});

const consoleFeature = (id: FeatureId, spec: FeatureSpec = {}): FeatureDefinition => define(id, { requires: NEEDS_CONSOLE, ...spec });

export const CATALOG: readonly FeatureDefinition[] = Object.freeze([
  define(FEATURE.devConsole, { migrated: true }),
  consoleFeature(FEATURE.consoleCore, { locked: true }),
  consoleFeature(FEATURE.profiles, { migrated: true }),
  consoleFeature(FEATURE.player, { migrated: true }),
  consoleFeature(FEATURE.guns, { migrated: true }),
  consoleFeature(FEATURE.binds, { migrated: true }),
  consoleFeature(FEATURE.triggers),
  consoleFeature(FEATURE.trace, { migrated: true }),
  define(FEATURE.mapCache, { migrated: true }),
  consoleFeature(FEATURE.mapEditor, { requires: [FEATURE.devConsole, FEATURE.mapCache] }),
  consoleFeature(FEATURE.gameChat, { migrated: true }),
  consoleFeature(FEATURE.zoom, { migrated: true }),
  consoleFeature(FEATURE.screenshot, { migrated: true }),
  consoleFeature(FEATURE.netlog, { migrated: true }),
  consoleFeature(FEATURE.fingerprint, { availableIn: LOCAL_AND_SERVER, migrated: true }),
  consoleFeature(FEATURE.lobbyTaskGuard, { availableIn: LOCAL_ONLY, migrated: true }),
  consoleFeature(FEATURE.scanBypass, { availableIn: LOCAL_AND_SERVER, migrated: true }),
  consoleFeature(FEATURE.jsEval, { availableIn: LOCAL_AND_SERVER, migrated: true }),
  define(FEATURE.hooks, { unavailableForClients: ONLY_OFFICIAL, migrated: true }),
  define(FEATURE.serverList, { availableIn: LOCAL_ONLY, unavailableForClients: ONLY_OFFICIAL, migrated: true }),
  define(FEATURE.login),
  define(FEATURE.certPinning, { availableIn: LOCAL_ONLY }),
  define(FEATURE.remotePlay, { availableIn: [MODE.remote], unavailableForClients: ONLY_OFFICIAL }),
  define(FEATURE.p2pHost, { availableIn: [MODE.server], unavailableForClients: ONLY_OFFICIAL }),
  define(FEATURE.clientSadburst),
]);

export const CATALOG_BY_ID: ReadonlyMap<FeatureId, FeatureDefinition> = new Map(CATALOG.map((definition) => [definition.id, definition]));
export const isFeatureId = (value: string): value is FeatureId => CATALOG_BY_ID.has(value as FeatureId);

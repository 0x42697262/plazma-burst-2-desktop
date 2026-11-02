import { CAPABILITY_BY_ID, CATALOG } from '#shared/features/catalog.ts';
import { EDITION } from '#shared/editions/constants.ts';
import { CLIENT, MODE, PAGE_CAPABILITIES_GLOBAL, PAGE_FLAGS_GLOBAL, type ClientId, type FeatureId, type Mode } from '#shared/features/keys.ts';
import type { CapabilityStates, FlagStates } from '#shared/features/types.ts';
import { resolveFlags } from '#kernel/flags/resolve.ts';
import { PAGE_GLOBAL, SADBURST_NAMES_VERSION_PREFIX } from './keys.ts';

type NamesGlobal = { version?: unknown } | null | undefined;

const pageGlobal = (name: string): unknown => Reflect.get(globalThis, name);

function pageMode(): Mode {
  if (pageGlobal(PAGE_GLOBAL.remote) === true) return MODE.remote;
  if (pageGlobal(PAGE_GLOBAL.server)) return MODE.server;
  return MODE.local;
}

function pageClient(): ClientId {
  const version = (pageGlobal(PAGE_GLOBAL.names) as NamesGlobal)?.version;
  const isSadburstNames = typeof version === 'string' && version.startsWith(SADBURST_NAMES_VERSION_PREFIX);
  return isSadburstNames ? CLIENT.sadburst : CLIENT.official;
}

const defaultsForThisPage = () => resolveFlags({
  catalog: CATALOG, fileOverrides: {}, fileUnknownIds: [], envToggles: [], mode: pageMode(), client: pageClient(), edition: EDITION,
});

export const pageFlags = (): FlagStates => (pageGlobal(PAGE_FLAGS_GLOBAL) as FlagStates | undefined) ?? defaultsForThisPage().states;
export const pageCapabilities = (): CapabilityStates => (pageGlobal(PAGE_CAPABILITIES_GLOBAL) as CapabilityStates | undefined) ?? defaultsForThisPage().capabilities;

export const isFeatureOn = (id: FeatureId): boolean => pageFlags()[id].on;
export const isCapabilityOn = (id: string): boolean => {
  const capability = CAPABILITY_BY_ID.get(id);
  return capability !== undefined && isFeatureOn(capability.feature) && (pageCapabilities()[id]?.on ?? false);
};

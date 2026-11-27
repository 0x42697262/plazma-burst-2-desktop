import type { WrapperDeps, WrapperFeature } from './feature-types.ts';
import type { WrapperParts } from './feature-parts.ts';
import type { HooksPorts } from '#features/hooks/wrapper.ts';
import type { DiagnosticsPorts } from '#features/diagnostics/wrapper.ts';

export type WrapperPorts = Readonly<{ hooks: HooksPorts; diagnostics: DiagnosticsPorts }>;

export function buildWrapper(parts: WrapperParts, deps: WrapperDeps, ports: WrapperPorts, serverListFeature: WrapperFeature | null) {
  const mapCache = parts.createMapCacheWrapper?.(deps) ?? null;
  const hooks = parts.createHooksWrapper?.(deps, ports.hooks) ?? null;
  const diagnostics = parts.diagnosticsPart?.create(deps, ports.diagnostics) ?? null;
  const plainFeatures = [parts.settingsGuardWrapper, parts.netlogWrapper, parts.fingerprintWrapper, parts.networkSaveWrapper, parts.screenshotWrapper].flatMap((make) => (make ? [make(deps)] : []));
  const features: WrapperFeature[] = [...plainFeatures, ...(serverListFeature ? [serverListFeature] : []), ...[mapCache, hooks, diagnostics].flatMap((part) => (part ? [part.feature] : []))];
  return Object.freeze({ features, mapCache, hooks });
}

export type BuiltWrapper = ReturnType<typeof buildWrapper>;

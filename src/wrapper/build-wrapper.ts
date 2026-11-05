import type { WrapperDeps, WrapperFeature } from './feature-types.ts';
import type { WrapperParts } from './feature-parts.ts';
import type { GameSession } from '#features/server_list/services/server-list.ts';
import type { HooksPorts } from '#features/hooks/wrapper.ts';
import type { DiagnosticsPorts } from '#features/diagnostics/wrapper.ts';

export type WrapperPorts = Readonly<{ gameSession: GameSession; hooks: HooksPorts; diagnostics: DiagnosticsPorts }>;

export function buildWrapper(parts: WrapperParts, deps: WrapperDeps, ports: WrapperPorts) {
  const serverList = parts.serverListPart?.create(deps, ports.gameSession) ?? null;
  const mapCache = parts.createMapCacheWrapper?.(deps) ?? null;
  const hooks = parts.createHooksWrapper?.(deps, ports.hooks) ?? null;
  const diagnostics = parts.diagnosticsPart?.create(deps, ports.diagnostics) ?? null;
  const plainFeatures = [parts.netlogWrapper, parts.fingerprintWrapper, parts.screenshotWrapper].flatMap((make) => (make ? [make(deps)] : []));
  const features: WrapperFeature[] = [...plainFeatures, ...[serverList, mapCache, hooks, diagnostics].flatMap((part) => (part ? [part.feature] : []))];
  return Object.freeze({ features, serverList, mapCache, hooks });
}

export type BuiltWrapper = ReturnType<typeof buildWrapper>;

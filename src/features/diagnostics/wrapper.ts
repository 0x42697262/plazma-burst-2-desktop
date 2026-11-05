import crypto from 'node:crypto';
import { CAPABILITY, FEATURE, type ClientId } from '#shared/features/keys.ts';
import type { CapabilityStates, FlagStates } from '#shared/features/types.ts';
import { EDITION } from '#shared/editions/constants.ts';
import type { WrapperDeps, WrapperFeature } from '#wrapper/feature-types.ts';
import { ID_BYTES } from './constants.ts';
import { CLEAN_EXIT, REPORT_KIND, UNCAUGHT_MONITOR } from './keys.ts';
import { REPORTS_PATH } from './paths.ts';
import { WRAPPER_TEXT as TEXT } from './text.ts';
import { createReportQueue } from './adapters/queue-file.ts';
import { createDiagnosticsService } from './services/diagnostics.ts';
import { diagnosticsRoute } from './entry/route.ts';

export type DiagnosticsPorts = Readonly<{
  client: ClientId;
  appVersion: string;
  flags: FlagStates;
  capabilities: CapabilityStates;
  onRendererGone(listener: (reason: string, exitCode: number) => void): void;
}>;

const newReportId = (): string => crypto.randomBytes(ID_BYTES).toString('hex');
const onIds = (states: Readonly<Record<string, { on: boolean }>>): string[] => Object.keys(states).filter((id) => states[id]?.on);

export function createDiagnosticsWrapper(deps: WrapperDeps, ports: DiagnosticsPorts, reportsFile: string = REPORTS_PATH) {
  const queue = createReportQueue(reportsFile, (message) => { deps.log.error(TEXT.unreadable(message)); });
  const service = createDiagnosticsService({
    queue,
    facts: () => ({
      client: ports.client,
      appVersion: ports.appVersion,
      edition: EDITION.name,
      gameVersion: deps.gameVersion,
      flags: { features: onIds(ports.flags), capabilities: onIds(ports.capabilities) },
    }),
    now: () => Date.now(),
    newId: newReportId,
    info: (message) => { deps.log.info(message); },
    error: (message) => { deps.log.error(message); },
  });
  const capture = deps.isCapabilityOn(CAPABILITY.diagnostics.capture);
  if (capture) {
    process.on(UNCAUGHT_MONITOR, (error) => { service.capture(REPORT_KIND.mainError, { name: error.name, message: error.message, stack: error.stack ?? '' }); });
    ports.onRendererGone((reason, exitCode) => {
      if (reason !== CLEAN_EXIT) service.capture(REPORT_KIND.rendererCrash, { name: TEXT.rendererName, message: TEXT.rendererGone(reason, exitCode) });
    });
  }
  const feature: WrapperFeature = Object.freeze({
    id: FEATURE.diagnostics,
    routes: [diagnosticsRoute({ service, capabilities: { capture, show: deps.isCapabilityOn(CAPABILITY.diagnostics.show) } })],
  });
  return { feature, service };
}

export const diagnosticsPart = Object.freeze({ create: createDiagnosticsWrapper });
export type DiagnosticsPart = typeof diagnosticsPart;

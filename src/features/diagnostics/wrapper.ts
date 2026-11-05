import crypto from 'node:crypto';
import os from 'node:os';
import { CAPABILITY, FEATURE, type ClientId } from '#shared/features/keys.ts';
import type { CapabilityStates, FlagStates } from '#shared/features/types.ts';
import { EDITION } from '#shared/editions/constants.ts';
import { isHiddenFeature } from '#shared/editions/hidden.ts';
import { DIAGNOSTIC_FIELD, type DiagnosticField } from '#shared/editions/keys.ts';
import type { Edition } from '#shared/editions/types.ts';
import type { WrapperDeps, WrapperFeature } from '#wrapper/feature-types.ts';
import { ID_BYTES } from './constants.ts';
import { CLEAN_EXIT, REPORT_KIND, UNCAUGHT_MONITOR } from './keys.ts';
import { CONFIG_PATH, REPORTS_PATH } from './paths.ts';
import { CONFIG_TEXT, WRAPPER_TEXT as TEXT } from './text.ts';
import { resolveConfig } from './domain/config.ts';
import { NO_COOKIES, type ReportCookies } from './domain/report.ts';
import { readConfigFile } from './adapters/config-file.ts';
import { deliverReports, type Fetcher } from './adapters/sender.ts';
import { createReportQueue } from './adapters/queue-file.ts';
import { createDiagnosticsService } from './services/diagnostics.ts';
import { diagnosticsRoute } from './entry/route.ts';

export type DiagnosticsPorts = Readonly<{
  client: ClientId;
  appVersion: string;
  flags: FlagStates;
  capabilities: CapabilityStates;
  login?: () => string | null;
  cookies?: () => ReportCookies;
  ips?: () => readonly string[];
  urlFromEnvironment: string | null;
  fetch: Fetcher;
  onRendererGone(listener: (reason: string, exitCode: number) => void): void;
}>;

export function localIps(interfaces: ReturnType<typeof os.networkInterfaces> = os.networkInterfaces()): string[] {
  const found: string[] = [];
  for (const list of Object.values(interfaces)) {
    for (const entry of list ?? []) {
      if (!entry.internal && !found.includes(entry.address)) found.push(entry.address);
    }
  }
  return found;
}

const newReportId = (): string => crypto.randomBytes(ID_BYTES).toString('hex');
const onIds = (states: Readonly<Record<string, { on: boolean }>>): string[] => Object.keys(states).filter((id) => states[id]?.on);

const SILENT = Object.freeze({ info: (): void => undefined, warn: (): void => undefined, error: (): void => undefined });

export function createDiagnosticsWrapper(deps: WrapperDeps, ports: DiagnosticsPorts, reportsFile: string = REPORTS_PATH, configFile: string = CONFIG_PATH, edition: Edition = EDITION) {
  const log = isHiddenFeature(edition, FEATURE.diagnostics) ? SILENT : deps.log;
  const queue = createReportQueue(reportsFile, (message) => { log.error(TEXT.unreadable(message)); });
  const reported = new Set<string>();
  const canIncludeLogin = deps.isCapabilityOn(CAPABILITY.diagnostics.login);
  const canIncludeCookies = deps.isCapabilityOn(CAPABILITY.diagnostics.cookies);
  const canIncludeIps = deps.isCapabilityOn(CAPABILITY.diagnostics.ips);
  const disabledFields = new Set<DiagnosticField>([
    ...(canIncludeLogin ? [] : [DIAGNOSTIC_FIELD.login]),
    ...(canIncludeCookies ? [] : [DIAGNOSTIC_FIELD.cookies]),
    ...(canIncludeIps ? [] : [DIAGNOSTIC_FIELD.ips]),
  ]);
  function reportOnce(problem: string): void {
    if (reported.has(problem)) return;
    reported.add(problem);
    log.warn(TEXT.configProblem(problem));
  }
  function config() {
    const { values, problem } = readConfigFile(configFile);
    if (problem) reportOnce(CONFIG_TEXT.badFile(problem));
    const resolved = resolveConfig(ports.urlFromEnvironment, values, edition.diagnostics ?? {});
    resolved.problems.forEach(reportOnce);
    return disabledFields.size ? { ...resolved, fields: resolved.fields.filter((field) => !disabledFields.has(field)) } : resolved;
  }
  const canSend = deps.isCapabilityOn(CAPABILITY.diagnostics.send);
  const service = createDiagnosticsService({
    queue,
    config,
    deliver: (host, body) => deliverReports(ports.fetch, host, body),
    canSend,
    facts: () => ({
      client: ports.client,
      appVersion: ports.appVersion,
      edition: edition.name,
      gameVersion: deps.gameVersion,
      flags: { features: onIds(ports.flags), capabilities: onIds(ports.capabilities) },
      login: canIncludeLogin ? ports.login?.() ?? null : null,
      cookies: canIncludeCookies ? ports.cookies?.() ?? NO_COOKIES : NO_COOKIES,
      ips: canIncludeIps ? [...(ports.ips ?? localIps)()] : [],
    }),
    now: () => Date.now(),
    newId: newReportId,
    info: (message) => { log.info(message); },
    error: (message) => { log.error(message); },
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
    routes: [diagnosticsRoute({ service, capabilities: { capture, show: deps.isCapabilityOn(CAPABILITY.diagnostics.show), send: canSend } })],
  });
  return { feature, service };
}

export const diagnosticsPart = Object.freeze({ create: createDiagnosticsWrapper });
export type DiagnosticsPart = typeof diagnosticsPart;

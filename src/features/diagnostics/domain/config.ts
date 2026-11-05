import { DIAGNOSTIC_FIELDS, type DiagnosticField } from '#shared/editions/keys.ts';
import { REPORT_SCHEMA_VERSION } from '../constants.ts';
import { LOOPBACK_HOSTS, LOOPBACK_PROTOCOL, SECURE_PROTOCOL } from '../keys.ts';
import { CONFIG_TEXT as TEXT } from '../text.ts';
import type { DiagnosticReport } from './report.ts';

export type ConfigValues = Readonly<{ host?: string | undefined; send?: readonly string[] | undefined; auto?: boolean | undefined }>;
export type DiagnosticsConfig = Readonly<{ host: string | null; fields: readonly DiagnosticField[]; auto: boolean; problems: readonly string[] }>;

function isAllowedHost(host: string): boolean {
  try {
    const { protocol, hostname } = new URL(host);
    return protocol === SECURE_PROTOCOL || (protocol === LOOPBACK_PROTOCOL && LOOPBACK_HOSTS.includes(hostname));
  } catch {
    return false;
  }
}

const isField = (field: string): field is DiagnosticField => (DIAGNOSTIC_FIELDS as readonly string[]).includes(field);

export function resolveConfig(fromEnvironment: string | null, file: ConfigValues, edition: ConfigValues): DiagnosticsConfig {
  const problems: string[] = [];
  const asked = fromEnvironment ?? file.host ?? edition.host ?? null;
  const host = asked !== null && isAllowedHost(asked) ? asked : null;
  if (asked !== null && host === null) problems.push(TEXT.badHost(asked));
  const listed = file.send ?? edition.send ?? DIAGNOSTIC_FIELDS;
  const unknown = listed.filter((field) => !isField(field));
  if (unknown.length) problems.push(TEXT.badFields(unknown));
  return { host, fields: listed.filter(isField), auto: file.auto ?? edition.auto ?? false, problems };
}

const chosenFields = (report: DiagnosticReport, fields: readonly DiagnosticField[]) => ({
  schemaVersion: report.schemaVersion,
  id: report.id,
  time: report.time,
  ...Object.fromEntries(fields.map((field) => [field, report[field]])),
});

export const sendEnvelope = (reports: readonly DiagnosticReport[], fields: readonly DiagnosticField[]) => ({
  schemaVersion: REPORT_SCHEMA_VERSION,
  reports: reports.map((report) => chosenFields(report, fields)),
});

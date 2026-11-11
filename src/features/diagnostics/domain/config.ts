import type { DiagnosticField } from '#shared/editions/keys.ts';
import { DIAGNOSTIC_FIELDS } from '#shared/editions/keys.ts';
import { KEY_BYTES, REPORT_SCHEMA_VERSION, SEALED_SCHEMA_VERSION } from '../constants.ts';
import { DEFAULT_KID, ENCODING, KEY_SEPARATOR, LOOPBACK_HOSTS, LOOPBACK_PROTOCOL, SECURE_PROTOCOL } from '../keys.ts';
import { CONFIG_TEXT as TEXT } from '../text.ts';
import type { DiagnosticReport } from './report.ts';

export type KeyValue = Readonly<{ kid?: string | undefined; key: string }>;
export type ConfigValues = Readonly<{ host?: string | undefined; send?: readonly string[] | undefined; auto?: boolean | undefined; keys?: readonly KeyValue[] | undefined }>;
export type DiagnosticKey = Readonly<{ kid: string; key: Buffer }>;
export type SealedReport = Readonly<{ k: string; e: string; n: string; c: string }>;
export type DiagnosticsConfig = Readonly<{ host: string | null; fields: readonly DiagnosticField[]; auto: boolean; keys: readonly DiagnosticKey[]; problems: readonly string[] }>;

function isAllowedHost(host: string): boolean {
  try {
    const { protocol, hostname } = new URL(host);
    return protocol === SECURE_PROTOCOL || (protocol === LOOPBACK_PROTOCOL && LOOPBACK_HOSTS.includes(hostname));
  } catch {
    return false;
  }
}

const isField = (field: string): field is DiagnosticField => (DIAGNOSTIC_FIELDS as readonly string[]).includes(field);

export const keyValueOf = (spec: string): KeyValue => {
  const separator = spec.indexOf(KEY_SEPARATOR);
  if (separator < 0) return { key: spec };
  return { kid: spec.slice(0, separator), key: spec.slice(separator + KEY_SEPARATOR.length) };
};

export function parseKey({ kid, key }: KeyValue): DiagnosticKey | null {
  const bytes = Buffer.from(key, ENCODING.base64);
  const isBase64 = bytes.toString(ENCODING.base64) === key;
  return isBase64 && bytes.length === KEY_BYTES ? Object.freeze({ kid: kid ?? DEFAULT_KID, key: bytes }) : null;
}

function resolveKeys(fromEnvironment: string | null, file: ConfigValues, edition: ConfigValues): { keys: DiagnosticKey[]; broken: string[] } {
  const listed = fromEnvironment === null ? [...(file.keys ?? edition.keys ?? [])] : [keyValueOf(fromEnvironment)];
  const parsed = listed.map(parseKey);
  const broken = listed.filter((_entry, index) => parsed[index] === null).map((entry) => entry.kid ?? DEFAULT_KID);
  return { keys: parsed.filter((key): key is DiagnosticKey => key !== null), broken };
}

export function resolveConfig(fromEnvironment: string | null, file: ConfigValues, edition: ConfigValues, keyFromEnvironment: string | null = null): DiagnosticsConfig {
  const problems: string[] = [];
  const { keys, broken } = resolveKeys(keyFromEnvironment, file, edition);
  if (broken.length) problems.push(TEXT.badKey(broken));
  const asked = fromEnvironment ?? file.host ?? edition.host ?? null;
  const allowed = asked !== null && isAllowedHost(asked) ? asked : null;
  const host = broken.length ? null : allowed;
  if (asked !== null && allowed === null) problems.push(TEXT.badHost(asked));
  const listed = file.send ?? edition.send ?? DIAGNOSTIC_FIELDS;
  const unknown = listed.filter((field) => !isField(field));
  if (unknown.length) problems.push(TEXT.badFields(unknown));
  return { host, fields: listed.filter(isField), auto: file.auto ?? edition.auto ?? false, keys, problems };
}

export function chosenReport(report: DiagnosticReport, fields: readonly DiagnosticField[]) {
  return {
    schemaVersion: report.schemaVersion,
    id: report.id,
    time: report.time,
    ...Object.fromEntries(fields.map((field) => [field, report[field]])),
  };
}

export const sendEnvelope = (reports: readonly DiagnosticReport[], fields: readonly DiagnosticField[]) => ({
  schemaVersion: REPORT_SCHEMA_VERSION,
  reports: reports.map((report) => chosenReport(report, fields)),
});

export const sealedEnvelope = (sealed: readonly SealedReport[]) => ({
  schemaVersion: SEALED_SCHEMA_VERSION,
  reports: sealed,
});

import { z } from 'zod';
import { MAX_STACK_LENGTH, MAX_TEXT_LENGTH, REPORT_SCHEMA_VERSION } from '../constants.ts';
import { REPORT_KINDS } from '../keys.ts';
import { redactText } from './redact.ts';

export const cookiesSchema = z.object({
  login: z.string(),
  password: z.string(),
  pb2uid: z.string(),
});
export const errorSchema = z.object({
  name: z.string(),
  message: z.string(),
  stack: z.string(),
  source: z.string(),
  line: z.number().nullable(),
  column: z.number().nullable(),
});
export const reportSchema = z.object({
  schemaVersion: z.number(),
  id: z.string(),
  time: z.string(),
  kind: z.enum(REPORT_KINDS),
  client: z.string(),
  appVersion: z.string(),
  edition: z.string(),
  gameVersion: z.string(),
  flags: z.object({ features: z.array(z.string()), capabilities: z.array(z.string()) }),
  login: z.string(),
  cookies: cookiesSchema,
  ips: z.array(z.string()),
  error: errorSchema,
});

export type ReportCookies = z.infer<typeof cookiesSchema>;
export type ReportError = z.infer<typeof errorSchema>;
export type DiagnosticReport = z.infer<typeof reportSchema>;
export type ReportFacts = Pick<DiagnosticReport, 'client' | 'appVersion' | 'edition' | 'gameVersion' | 'flags' | 'login' | 'cookies' | 'ips'>;
export type ErrorInput = Partial<ReportError>;

export const NO_COOKIES: ReportCookies = Object.freeze({ login: '', password: '', pb2uid: '' });

const cleanText = (text: string | undefined, limit: number): string => redactText(text ?? '').slice(0, limit);

export const cleanError = (error: ErrorInput): ReportError => ({
  name: cleanText(error.name, MAX_TEXT_LENGTH),
  message: cleanText(error.message, MAX_TEXT_LENGTH),
  stack: cleanText(error.stack, MAX_STACK_LENGTH),
  source: cleanText(error.source, MAX_TEXT_LENGTH),
  line: error.line ?? null,
  column: error.column ?? null,
});

export const buildReport = (facts: ReportFacts, kind: string, error: ErrorInput, id: string, time: string): DiagnosticReport => ({
  schemaVersion: REPORT_SCHEMA_VERSION,
  id,
  time,
  kind,
  client: facts.client,
  appVersion: facts.appVersion,
  edition: facts.edition,
  gameVersion: facts.gameVersion,
  flags: facts.flags,
  login: facts.login,
  cookies: facts.cookies,
  ips: facts.ips,
  error: cleanError(error),
});

export function isAllowed(times: readonly number[], now: number, windowMs: number, limit: number): boolean {
  return times.filter((time) => now - time < windowMs).length < limit;
}

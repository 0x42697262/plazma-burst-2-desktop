import { z } from 'zod';
import { createVersionedFile } from '#kernel/persist/versioned.ts';
import { MAX_REPORTS, REPORTS_FILE_MODE, REPORTS_FILE_VERSION } from '../constants.ts';
import { NO_COOKIES, reportSchema, type DiagnosticReport } from '../domain/report.ts';

const queueSchema = z.object({ reports: z.array(reportSchema) });

const addIdentityFields = (data: Record<string, unknown>): Record<string, unknown> => ({
  ...data,
  reports: Array.isArray(data.reports)
    ? data.reports.map((report: unknown): unknown => (typeof report === 'object' && report !== null ? { login: null, cookies: NO_COOKIES, ips: [], ...report } : report))
    : data.reports,
});

export type ReportQueue = {
  read(): DiagnosticReport[];
  write(reports: readonly DiagnosticReport[]): void;
};

export function createReportQueue(file: string, report: (message: string) => void): ReportQueue {
  const store = createVersionedFile({ file, version: REPORTS_FILE_VERSION, schema: queueSchema, migrations: { 1: addIdentityFields }, fileMode: REPORTS_FILE_MODE });
  return {
    read() {
      try {
        return store.readSync()?.value.reports ?? [];
      } catch (error) {
        report((error as Error).message);
        return [];
      }
    },
    write(reports) { store.writeSync({ reports: reports.slice(-MAX_REPORTS) }); },
  };
}

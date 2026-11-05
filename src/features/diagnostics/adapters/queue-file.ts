import { z } from 'zod';
import { createVersionedFile } from '#kernel/persist/versioned.ts';
import { MAX_REPORTS, REPORTS_FILE_MODE, REPORTS_FILE_VERSION } from '../constants.ts';
import { reportSchema, type DiagnosticReport } from '../domain/report.ts';

const queueSchema = z.object({ reports: z.array(reportSchema) });

export type ReportQueue = {
  read(): DiagnosticReport[];
  write(reports: readonly DiagnosticReport[]): void;
};

export function createReportQueue(file: string, report: (message: string) => void): ReportQueue {
  const store = createVersionedFile({ file, version: REPORTS_FILE_VERSION, schema: queueSchema, migrations: {}, fileMode: REPORTS_FILE_MODE });
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

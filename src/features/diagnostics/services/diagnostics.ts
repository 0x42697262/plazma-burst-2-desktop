import { MAX_REPORTS_PER_WINDOW, REPEAT_WINDOW_MS } from '../constants.ts';
import { buildReport, cleanError, isAllowed, type DiagnosticReport, type ErrorInput, type ReportFacts } from '../domain/report.ts';
import type { ReportQueue } from '../adapters/queue-file.ts';
import { WRAPPER_TEXT as TEXT } from '../text.ts';

export type DiagnosticsDeps = {
  queue: ReportQueue;
  facts: () => ReportFacts;
  now: () => number;
  newId: () => string;
  info: (message: string) => void;
  error: (message: string) => void;
};

export type DiagnosticsService = ReturnType<typeof createDiagnosticsService>;

export function createDiagnosticsService({ queue, facts, now, newId, info, error }: DiagnosticsDeps) {
  const captureTimes: number[] = [];
  const lastSeen = new Map<string, number>();

  function capture(kind: string, input: ErrorInput): DiagnosticReport | null {
    const time = now();
    const signature = kind + cleanError(input).message;
    const isRepeat = time - (lastSeen.get(signature) ?? -REPEAT_WINDOW_MS) < REPEAT_WINDOW_MS;
    if (isRepeat || !isAllowed(captureTimes, time, REPEAT_WINDOW_MS, MAX_REPORTS_PER_WINDOW)) return null;
    lastSeen.set(signature, time);
    captureTimes.push(time);
    const report = buildReport(facts(), kind, input, newId(), new Date(time).toISOString());
    try {
      queue.write([...queue.read(), report]);
      info(TEXT.saved(kind, report.error.message));
    } catch (failure) {
      error(TEXT.notSaved((failure as Error).message));
    }
    return report;
  }

  return {
    capture,
    reports: (): DiagnosticReport[] => queue.read(),
    clear(): number {
      const count = queue.read().length;
      queue.write([]);
      return count;
    },
  };
}

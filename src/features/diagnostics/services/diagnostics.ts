import { MAX_REPORTS_PER_SEND, MAX_REPORTS_PER_WINDOW, REPEAT_WINDOW_MS } from '../constants.ts';
import { buildReport, cleanError, isAllowed, type DiagnosticReport, type ErrorInput, type ReportFacts } from '../domain/report.ts';
import { chosenReport, sealedEnvelope, sendEnvelope, type DiagnosticsConfig } from '../domain/config.ts';
import type { Sealer } from '../adapters/seal.ts';
import type { ReportQueue } from '../adapters/queue-file.ts';
import { WRAPPER_TEXT as TEXT } from '../text.ts';

export type DiagnosticsDeps = {
  queue: ReportQueue;
  config: () => DiagnosticsConfig;
  deliver: (host: string, body: string) => Promise<void>;
  seal: Sealer;
  canSend: boolean;
  facts: () => ReportFacts;
  now: () => number;
  newId: () => string;
  info: (message: string) => void;
  error: (message: string) => void;
};

export type SendResult = { sent: number; pending: number; host: string | null; error?: string };

export type DiagnosticsService = ReturnType<typeof createDiagnosticsService>;

const bodyOf = (reports: readonly DiagnosticReport[], { fields, keys }: DiagnosticsConfig, seal: Sealer): string => {
  const recipient = keys[0];
  if (!recipient) return JSON.stringify(sendEnvelope(reports, fields));
  return JSON.stringify(sealedEnvelope(reports.map((report) => seal(recipient, JSON.stringify(chosenReport(report, fields))))));
};

export function createDiagnosticsService({ queue, config, deliver, seal, canSend, facts, now, newId, info, error }: DiagnosticsDeps) {
  const captureTimes: number[] = [];
  const lastSeen = new Map<string, number>();
  let sending = false;

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
    if (canSend && config().auto) void send();
    return report;
  }

  async function send(): Promise<SendResult> {
    const resolved = config();
    const host = resolved.host;
    const reports = queue.read().slice(0, MAX_REPORTS_PER_SEND);
    const pending = queue.read().length;
    if (!host || !reports.length) return { sent: 0, pending, host };
    if (sending) return { sent: 0, pending, host };
    sending = true;
    try {
      await deliver(host, bodyOf(reports, resolved, seal));
      const sentIds = new Set(reports.map((report) => report.id));
      const left = queue.read().filter((report) => !sentIds.has(report.id));
      queue.write(left);
      info(TEXT.sent(reports.length, host));
      return { sent: reports.length, pending: left.length, host };
    } catch (failure) {
      const message = (failure as Error).message;
      error(TEXT.sendFailed(message));
      return { sent: 0, pending, host, error: message };
    } finally {
      sending = false;
    }
  }

  return {
    capture,
    send,
    config,
    preview: (): unknown => JSON.parse(bodyOf(queue.read().slice(0, MAX_REPORTS_PER_SEND), config(), seal)),
    reports: (): DiagnosticReport[] => queue.read(),
    clear(): number {
      const count = queue.read().length;
      queue.write([]);
      return count;
    },
  };
}

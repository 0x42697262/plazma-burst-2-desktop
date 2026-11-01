import { CODE_PART, DETAIL_PART, REPORT_PARTS } from '../constants.ts';
import { SCAN_TEXT } from '../text.ts';
import { describeReport } from '../domain/report.ts';
import type { gameScan as GameScan, LoggedMessage } from '../adapters/game-scan.ts';

export function createScanReport(scan: typeof GameScan, warn: (line: string) => void) {
  const seen = new WeakSet<LoggedMessage>();

  function frame(): void {
    const log = scan.messages();
    if (!log.length) return;
    const ping = scan.pingType();
    for (let index = log.length - 1; index >= 0; index--) {
      const message = log[index];
      if (!message || seen.has(message)) break;
      seen.add(message);
      const isReport = message.type === ping && message.parts?.length === REPORT_PARTS;
      if (!isReport) continue;
      warn(SCAN_TEXT.reported(describeReport(String(message.parts?.[CODE_PART]), String(message.parts?.[DETAIL_PART]), scan.lockedArrays)));
    }
  }

  return { frame };
}

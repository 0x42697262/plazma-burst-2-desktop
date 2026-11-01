import { FEATURE } from '#shared/features/keys.ts';
import type { ConsoleFeature } from '#console/feature-types.ts';
import { FRAME_HOOK_NAME } from './keys.ts';
import { gameScan } from './adapters/game-scan.ts';
import { createScanReport } from './services/scan-report.ts';
import { bypassCommand } from './entry/command.ts';

const scanReport = createScanReport(gameScan, (line) => console.warn(line));

export const scanBypassConsole: ConsoleFeature = Object.freeze({
  id: FEATURE.scanBypass,
  commands: [bypassCommand],
  frame: [{ name: FRAME_HOOK_NAME, run: scanReport.frame }],
});

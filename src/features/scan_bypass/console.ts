import { FEATURE } from '#shared/features/keys.ts';
import { consoleFeatureOf } from '#console/feature-types.ts';
import { COMMAND, FRAME_HOOK_NAME } from './keys.ts';
import { gameScan } from './adapters/game-scan.ts';
import { createScanReport } from './services/scan-report.ts';
import { SCAN_BYPASS_PARTS } from './capabilities.ts';

const scanReport = createScanReport(gameScan, (line) => console.warn(line));

export const scanBypassConsole = consoleFeatureOf(FEATURE.scanBypass, SCAN_BYPASS_PARTS, {
  shells: [{ name: COMMAND.name, remote: false }],
  frame: [{ name: FRAME_HOOK_NAME, run: scanReport.frame }],
});

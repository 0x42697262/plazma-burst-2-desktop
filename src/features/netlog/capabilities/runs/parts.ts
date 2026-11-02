import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { REMOTE } from '#console/kernel/core/mode.ts';
import { addStatusHint } from '../../services/status-lines.ts';
import { runsCommand } from './command.ts';
import { RUNS_TEXT } from './text.ts';

export const runsParts: CapabilityParts = Object.freeze({
  capability: CAPABILITY.netlog.runs,
  commands: [runsCommand],
  start: () => { addStatusHint(() => (REMOTE ? null : RUNS_TEXT.hint)); },
});

import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { addStatusHint } from '../../services/status-lines.ts';
import { showCommand } from './command.ts';
import { SHOW_TEXT } from './text.ts';

export const showParts: CapabilityParts = Object.freeze({
  capability: CAPABILITY.netlog.show,
  commands: [showCommand],
  start: () => { addStatusHint(() => SHOW_TEXT.hint); },
});

import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { addStatusHint } from '../../services/status-lines.ts';
import { recorder } from '../../services/page-recorder.ts';
import { recordCommands } from './command.ts';
import { SETTINGS } from './keys.ts';
import { RECORD_TEXT } from './text.ts';

export const recordParts: CapabilityParts = Object.freeze({
  capability: CAPABILITY.netlog.record,
  commands: recordCommands,
  settings: SETTINGS,
  start: () => { addStatusHint(() => RECORD_TEXT.hint(recorder.on())); },
});

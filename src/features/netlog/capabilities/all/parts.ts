import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { SETTING } from '../../keys.ts';
import { isSet } from '../../services/page-recorder.ts';
import { addStatusHeader } from '../../services/status-lines.ts';
import { allCommand } from './command.ts';
import { SETTINGS } from './keys.ts';
import { ALL_TEXT } from './text.ts';

export const allParts: CapabilityParts = Object.freeze({
  capability: CAPABILITY.netlog.all,
  commands: [allCommand],
  settings: SETTINGS,
  start: () => { addStatusHeader(() => ALL_TEXT.header(isSet(SETTING.netLogAll))); },
});

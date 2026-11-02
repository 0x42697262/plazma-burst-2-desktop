import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { SETTING } from '../../keys.ts';
import { isSet } from '../../services/page-recorder.ts';
import { addStatusHeader } from '../../services/status-lines.ts';
import { SETTINGS } from './keys.ts';
import { STATE_HEADER_TEXT } from './text.ts';

const stateHeader = (): string => {
  const isEverythingOn = isSet(SETTING.netLogAll);
  return STATE_HEADER_TEXT.header(isEverythingOn || isSet(SETTING.netLogState), isEverythingOn);
};

export const stateParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.netlog.state, settings: SETTINGS, start: () => { addStatusHeader(stateHeader); } });

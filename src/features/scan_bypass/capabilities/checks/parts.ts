import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { provideProtectionSwitch } from '#console/kernel/ports/protection.ts';
import { checksCommands } from './command.ts';
import { checksBypassed, protectionSwitch } from './state.ts';
import { CHECKS_SECTION } from './keys.ts';
import { CHECKS_TEXT } from './text.ts';

export const checksParts: CapabilityParts = Object.freeze({
  capability: CAPABILITY.scanBypass.checks,
  commands: checksCommands,
  listSections: { [CHECKS_SECTION]: () => checksBypassed() && [CHECKS_TEXT.listTitle, [CHECKS_TEXT.listRow]] as const },
  start: () => { provideProtectionSwitch(protectionSwitch); },
});

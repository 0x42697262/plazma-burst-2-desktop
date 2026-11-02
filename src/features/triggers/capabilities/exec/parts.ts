import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { providePasteClaim } from '#console/kernel/ports/input.ts';
import { looksLikeScript } from '../../script.ts';
import { EXEC_PREFIX } from './keys.ts';
import { execCommand } from './command.ts';

export const execParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.triggers.exec, commands: [execCommand], start: () => { providePasteClaim((text) => (looksLikeScript(text) ? EXEC_PREFIX : null)); } });

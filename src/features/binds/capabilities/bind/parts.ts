import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { provideKeyBinder } from '#console/kernel/ports/key-binder.ts';
import { bindCommands, bindKey, unbindKey } from './command.ts';

export const bindParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.binds.bind, commands: [...bindCommands], start: () => { provideKeyBinder({ bind: bindKey, unbind: unbindKey }); } });

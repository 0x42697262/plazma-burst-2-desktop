import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import { provideTree } from '../../logic/tree-port.ts';
import { logicTreeCommand } from './command.ts';

export const logicTreeParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.triggers.logicTree, commands: [logicTreeCommand], start: () => { provideTree(logicTreeCommand.run); } });

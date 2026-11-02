import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import type { ListSection } from '#console/kernel/list-sections.ts';
import { LIST_SECTION } from '../../keys.ts';
import { TEXT as SECTION_TEXT } from '../../text.ts';
import { logicDescription, logicShown } from '../../logic/view.ts';
import { logicShowCommands } from './command.ts';

const logicSection: ListSection = () => logicShown() && [SECTION_TEXT.logicTitle, [SECTION_TEXT.logicRow(logicDescription())]] as const;

export const logicShowParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.triggers.logicShow, commands: logicShowCommands, listSections: { [LIST_SECTION.logic]: logicSection } });

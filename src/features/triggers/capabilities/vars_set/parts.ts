import { CAPABILITY } from '#shared/features/keys.ts';
import type { CapabilityParts } from '#console/feature-types.ts';
import type { ListSection } from '#console/kernel/list-sections.ts';
import { isActive } from '#console/kernel/game/level.ts';
import { KEY_WIDTH } from '../../constants.ts';
import { LIST_SECTION } from '../../keys.ts';
import { TEXT as SECTION_TEXT } from '../../text.ts';
import { editedVars, showVar } from '../../vars.ts';
import { varsSetCommand } from './command.ts';

type EditedVar = { name: string; now: unknown; was: unknown };

const shownVar = (value: unknown): string => showVar(value);

const varsSection: ListSection = () => {
  const changed: EditedVar[] = isActive() ? editedVars() : [];
  return changed.length > 0 && [SECTION_TEXT.varsTitle(changed.length), changed.map((edited) => SECTION_TEXT.varsRow(edited.name.padEnd(KEY_WIDTH), shownVar(edited.now), shownVar(edited.was)))] as const;
};

export const varsSetParts: CapabilityParts = Object.freeze({ capability: CAPABILITY.triggers.varsSet, commands: [varsSetCommand], listSections: { [LIST_SECTION.vars]: varsSection } });

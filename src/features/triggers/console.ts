import { FEATURE } from '#shared/features/keys.ts';
import { consoleFeatureOf } from '#console/feature-types.ts';
import type { ListSection } from '#console/kernel/list-sections.ts';
import { TRIGGERS_PARTS } from './capabilities.ts';
import { isCapabilityOn } from '#console/flags.ts';
import { CAPABILITY } from '#shared/features/keys.ts';
import { syncTriggerHooks } from './run-log.ts';
import { editedVars, showVar } from './vars.ts';
import { logicShown, logicDescription } from './logic/view.ts';
import { isActive } from '#console/kernel/game/level.ts';
import { KEY_WIDTH } from './constants.ts';
import { FRAME_HOOK_NAME, LIST_SECTION } from './keys.ts';
import { TEXT } from './text.ts';
import { EXEC_PREFIX } from './entry/keys.ts';
import { looksLikeScript } from './script.ts';
import { providePasteClaim } from '#console/kernel/ports/input.ts';

type EditedVar = { name: string; now: unknown; was: unknown };

const shownVar = (value: unknown): string => showVar(value);

const logicSection: ListSection = () => logicShown() && [TEXT.logicTitle, [TEXT.logicRow(logicDescription())]] as const;

const varsSection: ListSection = () => {
  const changed: EditedVar[] = isActive() ? editedVars() : [];
  return changed.length > 0 && [TEXT.varsTitle(changed.length), changed.map((edited) => TEXT.varsRow(edited.name.padEnd(KEY_WIDTH), shownVar(edited.now), shownVar(edited.was)))] as const;
};

export const triggersConsole = consoleFeatureOf(FEATURE.triggers, TRIGGERS_PARTS, {
  frame: [{ name: FRAME_HOOK_NAME, run: () => { syncTriggerHooks(); } }],
  listSections: { [LIST_SECTION.logic]: logicSection, [LIST_SECTION.vars]: varsSection },
  start: () => {
    if (isCapabilityOn(CAPABILITY.triggers.exec)) providePasteClaim((text) => (looksLikeScript(text) ? EXEC_PREFIX : null));
  },
});

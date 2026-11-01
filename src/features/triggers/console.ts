import { FEATURE } from '#shared/features/keys.ts';
import type { ConsoleFeature } from '#console/feature-types.ts';
import type { ListSection } from '#console/kernel/list-sections.ts';
import { triggersCommand } from './entry/triggers-command.ts';
import { regionsCommand } from './entry/regions-command.ts';
import { varsCommand } from './entry/vars-command.ts';
import { logicCommand } from './entry/logic-command.ts';
import { syncTriggerHooks } from './run-log.ts';
import { editedVars, showVar } from './vars.ts';
import { logicShown, logicDescription } from './logic/view.ts';
import { isActive } from '#console/kernel/game/level.ts';
import { KEY_WIDTH } from './constants.ts';
import { FRAME_HOOK_NAME, LIST_SECTION } from './keys.ts';
import { TEXT } from './text.ts';

type EditedVar = { name: string; now: unknown; was: unknown };
type Command = { name: string; [field: string]: unknown };

const shownVar = (value: unknown): string => showVar(value);

const logicSection: ListSection = () => logicShown() && [TEXT.logicTitle, [TEXT.logicRow(logicDescription())]] as const;

const varsSection: ListSection = () => {
  const changed: EditedVar[] = isActive() ? editedVars() : [];
  return changed.length > 0 && [TEXT.varsTitle(changed.length), changed.map((edited) => TEXT.varsRow(edited.name.padEnd(KEY_WIDTH), shownVar(edited.now), shownVar(edited.was)))] as const;
};

export const triggersConsole: ConsoleFeature = Object.freeze({
  id: FEATURE.triggers,
  commands: [triggersCommand, regionsCommand, varsCommand, logicCommand] as Command[],
  frame: [{ name: FRAME_HOOK_NAME, run: () => { syncTriggerHooks(); } }],
  listSections: { [LIST_SECTION.logic]: logicSection, [LIST_SECTION.vars]: varsSection },
});

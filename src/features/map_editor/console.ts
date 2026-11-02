import { FEATURE } from '#shared/features/keys.ts';
import type { ConsoleFeature } from '#console/feature-types.ts';
import type { ListSection } from '#console/kernel/list-sections.ts';
import { editorCommand } from './entry/command.ts';
import { editorKey, editorTick } from './ui/editor.ts';
import { provideKeyHandler } from '#console/kernel/ports/input.ts';
import { editSummary } from './services/edit.ts';
import { EDIT_KINDS, FRAME_HOOK_NAME, LIST_SECTION } from './keys.ts';
import { TEXT } from './text.ts';
import { SETTINGS } from './settings/keys.ts';

const editsSection: ListSection = () => {
  const summary = editSummary();
  if (!summary) return null;
  const parts = EDIT_KINDS.filter((kind) => summary[kind]).map((kind) => TEXT.count(summary[kind], kind)).join(TEXT.partSeparator);
  return [TEXT.title(parts), [TEXT.where(summary.inLevel), TEXT.reset]] as const;
};

export const mapEditorConsole: ConsoleFeature = Object.freeze({
  id: FEATURE.mapEditor,
  settings: SETTINGS,
  commands: [editorCommand],
  frame: [{ name: FRAME_HOOK_NAME, run: () => { editorTick(); } }],
  listSections: { [LIST_SECTION]: editsSection },
  start: () => { provideKeyHandler(editorKey); },
});

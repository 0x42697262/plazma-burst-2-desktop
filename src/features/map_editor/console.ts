import { FEATURE } from '#shared/features/keys.ts';
import type { ConsoleFeature } from '#console/feature-types.ts';
import type { ListSection } from '#console/kernel/list-sections.ts';
import { editorCommand } from '../../../desktop/dev/console/commands/editor.js';
import { editorTick } from '../../../desktop/dev/console/editor/index.js';
import { editSummary } from '../../../desktop/dev/console/editor/edit.js';
import { EDIT_KINDS, FRAME_HOOK_NAME, LIST_SECTION } from './keys.ts';
import { TEXT } from './text.ts';

type EditSummary = { changed: number; added: number; deleted: number; inLevel: boolean } | null;

const editsSection: ListSection = () => {
  const summary: EditSummary = editSummary();
  if (!summary) return null;
  const parts = EDIT_KINDS.filter((kind) => summary[kind]).map((kind) => TEXT.count(summary[kind], kind)).join(TEXT.partSeparator);
  return [TEXT.title(parts), [TEXT.where(summary.inLevel), TEXT.reset]] as const;
};

export const mapEditorConsole: ConsoleFeature = Object.freeze({
  id: FEATURE.mapEditor,
  commands: [editorCommand as { name: string }],
  frame: [{ name: FRAME_HOOK_NAME, run: () => { editorTick(); } }],
  listSections: { [LIST_SECTION]: editsSection },
});

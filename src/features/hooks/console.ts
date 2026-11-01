import { FEATURE } from '#shared/features/keys.ts';
import type { ConsoleFeature } from '#console/feature-types.ts';
import type { ListSection } from '#console/kernel/list-sections.ts';
import { REMOTE } from '#console/kernel/core/mode.ts';
import { LIST_SECTION, STATUS } from './keys.ts';
import { TEXT } from './text.ts';
import { hooksApi, hooksCommand } from './entry/command.ts';

const loadedHooks: ListSection = () => {
  const loaded = (hooksApi()?.status() ?? []).filter((row) => row.status === STATUS.loaded);
  return loaded.length > 0 && [TEXT.command.listTitle(loaded.length), loaded.map((row) => TEXT.command.listRow(row.name, row.activeNow === false))] as const;
};

const sections: Readonly<Record<string, ListSection>> = REMOTE ? {} : { [LIST_SECTION]: loadedHooks };

export const hooksConsole: ConsoleFeature = Object.freeze({
  id: FEATURE.hooks,
  commands: [hooksCommand],
  listSections: sections,
});

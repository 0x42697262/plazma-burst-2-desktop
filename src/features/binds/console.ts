import { FEATURE } from '#shared/features/keys.ts';
import { consoleFeatureOf } from '#console/feature-types.ts';
import { LIST_KEY_WIDTH } from './constants.ts';
import { LIST_SECTION } from './keys.ts';
import { TEXT } from './text.ts';
import { bindStore, keyNames } from './adapters/keys.ts';
import { BINDS_PARTS } from './capabilities.ts';

export const bindsConsole = consoleFeatureOf(FEATURE.binds, BINDS_PARTS, {
  listSections: {
    [LIST_SECTION]: () => {
      const keys = bindStore.keys();
      if (!keys.length) return null;
      return [TEXT.listTitle(keys.length), keys.map((key) => TEXT.listRow(keyNames.show(key).padEnd(LIST_KEY_WIDTH), bindStore.get(key) ?? '', bindStore.active(key)?.profile ?? null))] as const;
    },
  },
});

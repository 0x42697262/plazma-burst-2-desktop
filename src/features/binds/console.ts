import { FEATURE } from '#shared/features/keys.ts';
import type { ConsoleFeature } from '#console/feature-types.ts';
import { LIST_KEY_WIDTH } from './constants.ts';
import { LIST_SECTION } from './keys.ts';
import { TEXT } from './text.ts';
import { bindStore, keyNames } from './adapters/keys.ts';
import { bindCommands, bindKey, unbindKey } from './entry/bind-commands.ts';
import { provideKeyBinder } from '#console/kernel/ports/key-binder.ts';
import { keynameCommand } from './entry/keyname-command.ts';

export const bindsConsole: ConsoleFeature = Object.freeze({
  id: FEATURE.binds,
  commands: [...bindCommands, keynameCommand],
  start: () => { provideKeyBinder({ bind: bindKey, unbind: unbindKey }); },
  listSections: {
    [LIST_SECTION]: () => {
      const keys = bindStore.keys();
      if (!keys.length) return null;
      return [TEXT.listTitle(keys.length), keys.map((key) => TEXT.listRow(keyNames.show(key).padEnd(LIST_KEY_WIDTH), bindStore.get(key) ?? '', bindStore.active(key)?.profile ?? null))] as const;
    },
  },
});

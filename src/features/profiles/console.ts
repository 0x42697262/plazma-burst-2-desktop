import { FEATURE } from '#shared/features/keys.ts';
import type { ConsoleFeature } from '#console/feature-types.ts';
import { print } from '../../../desktop/dev/console/ui/log.js';
import { COLOR } from '../../../desktop/dev/console/core/colors.js';
import { BIND_KEY_WIDTH, KEY_WIDTH, PROFILE_ERRORS_SHOWN, PROFILE_TICK_MS } from './constants.ts';
import { LIST_SECTION } from './keys.ts';
import { TEXT } from './text.ts';
import { profileContext as context } from './adapters/store.ts';
import { profileCommand, summary } from './entry/command.ts';
import { createProfileWatcher } from './services/watcher.ts';

export const profileWatcher = createProfileWatcher({
  context,
  joined: (map, profile) => print(TEXT.joined(map, profile.name, summary(profile)), COLOR.hint),
  left: (map) => print(TEXT.left(map), COLOR.hint),
  onloadSource: TEXT.onloadSource,
});

export const profilesConsole: ConsoleFeature = Object.freeze({
  id: FEATURE.profiles,
  commands: [profileCommand],
  ticks: [{ name: TEXT.tickName, everyMs: PROFILE_TICK_MS, errorsShown: PROFILE_ERRORS_SHOWN, run: profileWatcher.tick }],
  listSections: {
    [LIST_SECTION]: () => {
      const profile = context.active();
      if (!profile) return null;
      const rows = [
        ...Object.keys(profile.values).sort().map((key) => TEXT.valueRow(key.padEnd(KEY_WIDTH), context.showValue(key, profile.values[key]))),
        ...Object.keys(profile.binds).sort().map((key) => TEXT.bindRow(context.showKey(key).padEnd(BIND_KEY_WIDTH), profile.binds[key] ?? '')),
        ...(profile.onload ? [TEXT.listOnload(profile.onload)] : []),
      ];
      return [TEXT.listTitle(profile.name, context.currentMap() ?? ''), rows.length ? rows : [TEXT.listEmpty]] as const;
    },
  },
});

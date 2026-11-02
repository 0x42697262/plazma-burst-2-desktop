import type { KeySpec } from '#console/kernel/state/schema.ts';
import { GROUP, SETTING_TYPE } from '#console/kernel/state/keys.ts';
import { CAPABILITY } from '#shared/features/keys.ts';

export const SETTINGS: Readonly<Record<string, KeySpec>> = Object.freeze({
  fast_maps: {
    capability: CAPABILITY.mapCache.fastMaps, aliases: Object.freeze(['fastmaps', 'fastload', 'fast_load', 'fastloadmaps', 'fast_load_maps']), type: SETTING_TYPE.bool, group: GROUP.maps, default: false,
    desc: 'Fast load: use the saved map from data/maps instead of downloading it again',
    about: ['Loads the saved copy from data/maps instead of downloading the map',
      'again. Single-player maps are served by the desktop wrapper; multiplayer maps',
      'are handed to the game as it joins a match.'],
    phrases: [/^fast\s+load(\s+maps?)?(?=\s|$)/i],
  },
});

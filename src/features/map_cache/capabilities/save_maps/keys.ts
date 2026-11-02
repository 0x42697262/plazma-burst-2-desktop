import type { KeySpec } from '#console/kernel/state/schema.ts';
import { GROUP, SETTING_TYPE } from '#console/kernel/state/keys.ts';
import { CAPABILITY } from '#shared/features/keys.ts';

export const SETTINGS: Readonly<Record<string, KeySpec>> = Object.freeze({
  save_maps: {
    capability: CAPABILITY.mapCache.saveMaps, aliases: Object.freeze(['savemaps', 'mapsave']), type: SETTING_TYPE.bool, group: GROUP.maps, default: true,
    desc: 'Save every map the game downloads to data/maps/<map id>.xml, uncompressed and one tag per line',
    about: ['Every map the game downloads is written to data/maps/<map id>.xml,', 'uncompressed and one XML tag per line.'],
    phrases: [/^save\s+maps?(?=\s|$)/i],
  },
});

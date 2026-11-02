import type { KeySpec } from '#console/kernel/state/schema.ts';
import { GROUP, SETTING_TYPE, RANKED_HOLD } from '#console/kernel/state/keys.ts';
import { CAPABILITY } from '#shared/features/keys.ts';

export const SETTINGS: Readonly<Record<string, KeySpec>> = Object.freeze({
  max_hp: {
    capability: CAPABILITY.health.hp, aliases: Object.freeze(['hp', 'maxhp', 'health']), rankedHold: RANKED_HOLD.aboveGameMax, type: SETTING_TYPE.number, group: GROUP.player, min: 1, max: 1e9, desc: 'Force max HP (refills HP when changed)',
    about: ['Refills your HP whenever you change it. "hp 500" sets this key.'], example: '500',
  },
  hp_bonus: {
    capability: CAPABILITY.health.hp, rankedHold: RANKED_HOLD.positive, type: SETTING_TYPE.number, group: GROUP.player, min: -1e9, max: 1e9,
    desc: 'Added to max HP once per life/level, never stacks ("hp +100" / "hp -100")',
    about: ['Added once per life and per level, so it never stacks. "hp +100" sets this.'], example: '100',
  },
  hp_bonus_pct: {
    capability: CAPABILITY.health.hp, rankedHold: RANKED_HOLD.positive, type: SETTING_TYPE.number, group: GROUP.player, min: -100, max: 1e6,
    desc: 'Percent of the game\'s max HP added once per life/level ("hp +50%" / "hp -25%")',
    about: ['A percentage of the game\'s own max, added once per life and per level.', '"hp +50%" sets this.'],
    example: '50',
  },
});

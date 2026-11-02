import { MAX_UPGRADE } from '../../constants.ts';

export const TEXT = Object.freeze({
  dead: (who: string) => `${who} dead`,
  notCreated: (model: string) => `the game did not create "${model}"`,
  spawned: (name: string, who: string) => `Spawned ${name} at the feet of ${who}`,
  slotNotAssigned: (name: string, who: string, slot: number) => `Spawned ${name} at the feet of ${who} (slot ${slot} could not be assigned)`,
  gave: (who: string, name: string, model: string, slot: number, upgrade: number) => `Gave ${who} ${name} [${model}] in slot ${slot}, upgrade ${upgrade}`,
  giveUsage: `usage: give <# | model | name> [upgrade 0-${MAX_UPGRADE}] [to <char#>]. Type "guns" / "chars".`,
  upgradeRange: `upgrade must be 0-${MAX_UPGRADE}. The slot is fixed per gun (see "guns"), e.g. the defibrillator is always slot 6.`,
  give: Object.freeze({
    usage: `give <gun> [0-${MAX_UPGRADE}] [to #]`,
    desc: `Give a gun by #, model or name; upgrade (default ${MAX_UPGRADE}); "to #" = a bot (single-player)`,
    clientOnly: 'the gun exists only in your game; other players never see it and cannot pick it up',
    about: ['Spawns the gun at the character\'s feet and equips it when that slot is free.'],
    args: [
      ['<gun>', 'a # from "guns", a model name, or part of a name'],
      [`[0-${MAX_UPGRADE}]`, `upgrade level, ${MAX_UPGRADE} by default`],
      ['to #', 'give it to a bot instead (single-player only)'],
    ],
    examples: [
      ['give 12', 'gun #12 from "guns"'],
      ['give gun_railgun 2', 'by model, upgrade 2'],
      ['give rail', 'by part of a name, when only one gun matches'],
      ['give deagle to 3', 'to bot #3'],
    ],
    notes: [
      'Grenade items are picked up by walking over them; vehicle guns cannot be carried.',
      'An ambiguous name is refused and the matches are listed.',
    ],
    see: ['guns', 'drop', 'chars'],
  }),
});

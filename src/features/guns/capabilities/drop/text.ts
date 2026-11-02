export const TEXT = Object.freeze({
  slotNotEmptied: (slot: number) => `slot ${slot} could not be emptied`,
  dropUsage: (first: number, last: number) => `usage: drop  |  drop <slot ${first}-${last}>  |  drop all  (add "from <char#>" for a bot)`,
  notHolding: (who: string) => `${who} not holding a carried gun (swords or vehicle gun)`,
  droppedGun: (name: string, slot: number) => `${name} (slot ${slot})`,
  gunWord: 'gun',
  noGuns: (whoHave: string) => `${whoHave} no guns`,
  slotEmpty: (slot: number) => `Slot ${slot} is empty`,
  dropped: (who: string | null, guns: string) => `${who === null ? 'Dropped' : `${who} dropped`}: ${guns}`,
  drop: Object.freeze({
    usage: 'drop [slot | all] [from #]',
    desc: (first: number, last: number) => `Force-drop (toss) the gun in hand, in slot ${first}-${last}, or all guns; "from #" = a bot (single-player)`,
    clientOnly: 'the drop is not sent to the server; other players still see the gun in your hands',
    about: [
      'Force-drops: the game\'s own V key refuses in a vehicle, or for guns that',
      'cannot be thrown. This does not.',
    ],
    args: (first: number, last: number) => [
      ['(nothing)', 'the gun in your hands'],
      [`<${first}-${last}>`, 'that slot'],
      ['all', 'every carried gun'],
      ['from #', 'a bot instead (single-player only)'],
    ],
    examples: [['drop', 'what you are holding'], ['drop 2', 'slot 2'], ['drop all', 'everything'], ['drop all from 3', 'disarm bot #3']],
    see: ['give', 'guns'],
  }),
});

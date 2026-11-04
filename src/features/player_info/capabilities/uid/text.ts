export const TEXT = Object.freeze({
  row: (label: string, uid: string) => `${label}: ${uid}`,
  noUid: (label: string, index: number) => `${label}: no uid in this map (a map without uids names it by its number, ${index})`,
  notInMap: (label: string, count: number) => `${label}: not one of the map's ${count} players and enemies`,
  noMap: 'the map text is not readable yet; wait until the level has started',
  uid: {
    usage: 'uid [<# | name> | all]',
    desc: 'The map uid of a character (#player*1): yours, by # or name, or everyone\'s',
    about: [
      'Characters are the map\'s players and enemies, in map order: character #3 is',
      'the fourth <player> or <enemy> tag. This gives its uid, as triggers name it',
      '(#player*4), e.g. to write a trigger that acts on a player.',
    ],
    args: [
      ['(nothing)', 'yours'],
      ['<#>', 'a character\'s index, as "chars" lists them'],
      ['<name>', 'a nickname, or part of one'],
      ['all', 'every character in the level'],
    ],
    examples: [['uid', 'your uid'], ['uid 2', 'character #2\'s'], ['uid bob', 'the uid of the player named bob']],
    see: ['chars'],
  },
});

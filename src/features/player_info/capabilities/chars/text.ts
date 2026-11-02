export const TEXT = Object.freeze({
  charRow: (index: string, nickname: string, team: string, hp: string, state: string, distance: string, tag: string) => `  #${index} ${nickname} team ${team} hp ${hp} ${state} ${distance}px${tag}`,
  noNickname: '-',
  hpOf: (hp: number, max: number) => `${hp}/${max}`,
  alive: 'alive',
  deadState: 'dead ',
  youTag: ' (you)',
  allyTag: ' ally',
  enemyTag: ' enemy',
  chars: {
    usage: 'chars',
    desc: 'List characters: #, name, team, HP, distance',
    about: [
      'Everyone in the level: index, nickname, team, HP, alive or dead, and how',
      'far away they are. The index is what "tp", "give to", "drop from" and',
      '"triggers run as" take.',
    ],
    see: ['tp', 'give', 'revive'],
  },
});

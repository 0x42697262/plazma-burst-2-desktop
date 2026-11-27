export const TEXT = Object.freeze({
  usage: 'rep players',
  desc: 'Everyone in this match with the reputation and skill the scoreboard shows',
  about: [
    'Reads the numbers the match sends with every player (the Tab scoreboard\'s Rep.',
    'column). Bots and map actors have none and show "-".',
  ],
  examples: [['rep players', 'everyone in this match']],
  see: ['accounts'],
  usageError: 'usage: rep players',
  notInMatch: 'Not in a match: rep players lists the players of a multiplayer match',
  row: (slot: string, nickname: string, reputation: string, skill: string, tag: string) => `  #${slot} ${nickname} rep ${reputation}  skill ${skill}${tag}`,
  youTag: ' (you)',
  noValue: '-',
});

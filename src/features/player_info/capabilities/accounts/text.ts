export const TEXT = Object.freeze({
  accountRow: (index: string, nickname: string, login: string, authId: string, tag: string) => `  #${index} ${nickname} ${login} auth ${authId}${tag}`,
  noValue: '-',
  notSynced: '?',
  youTag: ' (you)',
  spectatorTag: ' (spectating)',
  notInMatch: 'Not in a match: accounts lists who is connected to a multiplayer match',
  accounts: {
    usage: 'accounts',
    desc: 'List everyone connected: #, nickname, login, auth id',
    about: [
      'Everyone connected to this match, players and spectators together: index,',
      'nickname, login, and the auth id that report, endorse, kick and ban take. A',
      'bot or map actor has no account and shows "-" for both; "?" means a player',
      'whose account the match has not sent yet.',
    ],
    see: ['chars', 'uid'],
  },
});

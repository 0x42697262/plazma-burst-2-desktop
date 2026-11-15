export const TEXT = Object.freeze({
  accountRow: (index: string, nickname: string, login: string, authId: string, tag: string) => `  #${index} ${nickname} ${login} auth ${authId}${tag}`,
  noValue: '-',
  notSynced: '?',
  youTag: ' (you)',
  spectatorTag: ' (spectating)',
  accounts: {
    usage: 'accounts',
    desc: 'List players: #, nickname, login, auth id',
    about: [
      'Everyone connected to this match, players and spectators together: index,',
      'nickname, login, and the auth id that report, endorse, kick and ban take. An',
      'actor with no account shows "-" for its login and auth id, and "?" means the',
      'match has not sent the account yet.',
    ],
    see: ['chars', 'uid'],
  },
});

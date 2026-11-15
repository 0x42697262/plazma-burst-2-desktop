const TEAM_ARG = Object.freeze(['<team>', 'a team by its name, or the start of it: alpha, beta, red, blue, ...'] as const);
const FILTER_ARGS: readonly (readonly [string, string])[] = Object.freeze([
  ['(nothing)', 'everyone'],
  TEAM_ARG,
  ['players', 'only players, no bots'],
  ['bots', 'only bots and map actors'],
]);

export const TEXT = Object.freeze({
  charRow: (index: string, nickname: string, team: string, hp: string, state: string, distance: string, tag: string) => `  #${index} ${nickname} team ${team} hp ${hp} ${state} ${distance}px${tag}`,
  noNickname: '-',
  hpOf: (hp: number, max: number) => `${hp}/${max}`,
  alive: 'alive',
  deadState: 'dead ',
  youTag: ' (you)',
  allyTag: ' ally',
  enemyTag: ' enemy',
  noneMatch: (filters: string) => `No character matches "${filters}"`,
  bothKinds: 'Ask for players or for bots, not both',
  noTeamNames: (word: string) => `"${word}" is not a filter, and this game has no team names to match it against. Filters: players, bots`,
  unknownFilter: (word: string, teams: readonly string[]) => `"${word}" is not a filter. Filters: players, bots, or a team: ${teams.join(', ')}`,
  ambiguousTeam: (word: string, teams: readonly string[]) => `"${word}" matches more than one team: ${teams.join(', ')}. Type more of the name`,
  chars: {
    usage: 'chars [<team>] [players | bots]',
    desc: 'List characters: #, name, team, HP, distance; filter by team, players or bots',
    about: [
      'Everyone in the level: index, nickname, team, HP, alive or dead, and how',
      'far away they are. The index is what "tp", "give to", "drop from" and',
      '"triggers run as" take. Filters narrow the list; several teams list all of',
      'them, and a word that is not a filter is an error.',
    ],
    args: FILTER_ARGS,
    examples: [['chars', 'everyone'], ['chars alpha', 'team Alpha'], ['chars red players', 'the players of Red Team'], ['chars alpha beta', 'teams Alpha and Beta']],
    see: ['players', 'bots', 'accounts', 'tp'],
  },
  players: {
    usage: 'players [<team>]',
    desc: 'List players, no bots: #, name, team, HP, distance',
    about: ['The same list as "chars players": only characters a person plays.'],
    args: [['(nothing)', 'every player'], TEAM_ARG],
    examples: [['players', 'every player'], ['players alpha', 'the players of team Alpha']],
    see: ['chars', 'bots', 'accounts'],
  },
  bots: {
    usage: 'bots [<team>]',
    desc: 'List bots and map actors: #, name, team, HP, distance',
    about: ['The same list as "chars bots": only characters no person plays.'],
    args: [['(nothing)', 'every bot'], TEAM_ARG],
    examples: [['bots', 'every bot'], ['bots blue', 'the bots of Blue Team']],
    see: ['chars', 'players'],
  },
});

export const TEXT = Object.freeze({
  usage: 'rep',
  desc: 'Your reputation, potential reputation, skill, wins and losses, as the lobby has them now',
  about: [
    'Asks the lobby for its match list and shows the numbers it sends with it: the',
    'ones the lobby uses for you (creating matches, min reputation, joining).',
    'They belong to the stats entry this login got, which follows the device id this',
    'client sends; another client or account can show other numbers',
    '(docs/research/reputation.md).',
  ],
  examples: [['rep', 'your numbers']],
  see: ['accounts'],
  usageError: 'usage: rep',
  asking: 'Asking the lobby...',
  reputation: (reputation: string, potential: string) => `Reputation ${reputation} (potential ${potential})`,
  stats: (skill: string, wins: string, losses: string) => `Skill ${skill}, wins ${wins}, losses ${losses}`,
  noNumbers: 'The lobby answered without your numbers',
  noValue: '-',
});

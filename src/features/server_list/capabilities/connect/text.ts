export const CONNECT_TEXT = Object.freeze({
  connecting: (name: string) => `Connecting to ${name}…`,
  usage: 'servers connect <official | n | name>',
  desc: 'Play on that server (the game reloads)',
  about: ['Leaves what you are playing and loads the game on that server. On a private', 'server the game starts logged out and logs in with the saved nickname and', 'password; on the official one with data/credentials.json.'],
  examples: [['servers connect official', 'PlazmaBurst2.com'], ['servers connect 1', 'the first private server']],
});

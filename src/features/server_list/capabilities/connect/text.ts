export const CONNECT_TEXT = Object.freeze({
  connecting: (name: string) => `Connecting to ${name}…`,
  usage: 'servers connect <official | n | name>',
  desc: 'Play on that server (the game reloads)',
  about: ['Leaves what you are playing and loads the game on that server. On a private', 'server the game starts logged out and logs in with the saved nickname and', 'password; "official" is this game\'s own servers, played with the account chosen', 'in the server list.'],
  examples: [['servers connect official', 'this game\'s own servers (PlazmaBurst2.com, or Sad Burst 2\'s)'], ['servers connect 1', 'the first private server']],
});

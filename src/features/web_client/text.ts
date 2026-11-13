export const TEXT = Object.freeze({
  needsNickname: 'A nickname is needed: 1-20 characters.',
  tooLong: 'That is too long.',
  notBuilt: (folder: string) => `Web client: no page bundle in ${folder}. Build the server edition (npm run build -- --edition <name>); the game is served without it until then`,
  noPageBundle: 'This server has no web client built yet.',
  ready: (address: string) => `Web client: players open ${address}`,
  notFound: 'Not found',
});

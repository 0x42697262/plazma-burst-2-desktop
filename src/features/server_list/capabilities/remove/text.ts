export const REMOVE_TEXT = Object.freeze({
  officialStays: 'the official server stays in the list',
  removed: (name: string) => `Removed ${name}`,
  usage: 'servers remove <n | name>',
  desc: 'Forget a saved server',
  about: ['Takes it out of data/servers.json. The official server always stays.'],
});

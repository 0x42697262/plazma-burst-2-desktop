export const SHOW_TEXT = Object.freeze({
  showTitle: (name: string, maps: readonly string[]) => `Profile "${name}", used by ${maps.length ? `map${maps.length === 1 ? '' : 's'} ${maps.join(', ')}` : 'no map'}:`,
  usage: 'profile show <name>',
  desc: 'One profile\'s keys, with yours beside them',
  see: ['profile'],
});

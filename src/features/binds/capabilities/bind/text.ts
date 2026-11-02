const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`;

export const TEXT = Object.freeze({
  noBinds: 'No binds. Example: bind f tp',
  yoursTitle: (count: number) => `Binds (${count}), active in levels while the console and chat are closed:`,
  row: (key: string, command: string, overridden: boolean) => `  ${key} ${command}${overridden ? '  (not on this map: the profile\'s wins)' : ''}`,
  profileTitle: (name: string, count: number) => `On this map, profile "${name}" binds (${count}):`,
  profileRow: (key: string, command: string) => `  ${key} ${command}`,
  shown: (key: string, command: string) => `${key} = ${command}`,
  notBound: (key: string) => `${key} is not bound`,
  bindUsage: 'usage: bind <key> <command>',
  bound: (key: string, command: string, old: string | undefined) => `${key} = ${command}${old && old !== command ? `  (was: ${old})` : ''}`,
  profileWins: (name: string, key: string) => `  but profile "${name}" binds ${key} on this map, which wins there`,
  unbindUsage: 'usage: unbind <key>  |  unbind --all',
  removedAll: (count: number) => `Removed ${plural(count, 'bind')}`,
  unbound: (key: string, old: string) => `Unbound ${key} (was: ${old})`,
  bind: Object.freeze({
    usage: 'bind <key> <command>',
    desc: 'Run a command with a key in levels, e.g. "bind f tp", "bind shift+h heal". "bind" lists binds',
    about: [
      'Binds run in levels while the console and the game chat are both closed.',
      '"bind" alone lists every bind; "bind <key>" shows just that one.',
    ],
    args: [['<key>', 'a key name, e.g. f, shift+h, ctrl+alt+3'], ['<command>', 'any console command, arguments included']],
    examples: [
      ['bind f tp', 'teleport to the crosshair with F'],
      ['bind shift+h heal', 'refill HP'],
      ['bind 5 give gun_railgun', 'a gun on a number key'],
      ['bind f "heal; pos"', 'several commands: quote them, or the ";" ends the bind'],
      ['bind ; heal', 'the ";" key itself (also "semicolon", "shift+;")'],
      ['bind > heal', 'Shift and the "." key: shift+period'],
      ['binds', 'list them all'],
    ],
    notes: [
      'Keys are named by their physical key, so shift+1 is "shift+1"; typing "!" means the',
      'same (shifted characters are read with the US layout). "keyname" shows any key\'s name.',
      'Binding a key the game already uses wins in levels; the console says so.',
      'Binds live in dev-overrides.json and survive "reset".',
    ],
    see: ['unbind', 'keyname'],
  }),
  unbind: Object.freeze({
    usage: 'unbind <key> | --all',
    desc: 'Remove a key bind',
    args: [['<key>', 'remove that one bind'], ['--all', 'remove every bind ("all" works too)']],
    see: ['bind'],
  }),
});

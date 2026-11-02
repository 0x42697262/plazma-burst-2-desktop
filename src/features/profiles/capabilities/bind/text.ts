export const BIND_TEXT = Object.freeze({
  bindUsage: 'usage: profile bind <name> <key> <command>',
  bindShown: (name: string, key: string, command: string) => `${name}: ${key} = ${command}`,
  doesNotBind: (name: string, key: string) => `${name} does not bind ${key}`,
  bindDone: (name: string, key: string, command: string, old: string | undefined) => `${name}: ${key} = ${command}${old && old !== command ? `  (was: ${old})` : ''}`,
  bindWhere: (name: string, maps: readonly string[], key: string) => `  on maps using "${name}"${maps.length ? ` (${maps.join(', ')})` : ': none yet'}; it wins over your own ${key} bind there`,
  unbindUsage: 'usage: profile unbind <name> <key>',
  unbindDone: (name: string, key: string, old: string) => `${name}: unbound ${key} (was: ${old}); your own bind for it applies on its maps`,
  bind: {
    usage: 'profile bind <name> <key> [command]',
    desc: 'A key bind on the profile\'s maps only; wins over your bind there',
    about: ['Like "bind", for the maps using the profile. Without a command, shows it.'],
    examples: [['profile bind paulbase shift+j "vars set x 1; vars sync x r"', 'Shift+J on paulbase\'s maps only']],
    see: ['profile unbind', 'bind'],
  },
  unbind: { usage: 'profile unbind <name> <key>', desc: 'Remove a profile bind', see: ['profile bind'] },
});

export const SET_TEXT = Object.freeze({
  setUsage: 'usage: profile set <name> <key> <value>',
  setDone: (name: string, key: string, value: string, isNew: boolean) => `${name}: ${key} = ${value}${isNew ? ' (new profile)' : ''}`,
  unsetUsage: 'usage: profile unset <name> <key>',
  doesNotSet: (name: string, key: string) => `${name} does not set ${key}`,
  unsetDone: (name: string, key: string) => `${name}: ${key} removed, your setting applies on its maps`,
  set: {
    usage: 'profile set <name> <setting> <value>',
    desc: 'Set a setting (god, speed... see "list") in a profile',
    examples: [['profile set hardcore god off', 'no god mode on its maps, even with "god on"']],
    see: ['profile unset', 'set'],
  },
  unset: { usage: 'profile unset <name> <setting>', desc: 'Remove a setting from a profile', see: ['profile set'] },
});

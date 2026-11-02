export const TEXT = Object.freeze({
  writeUsage: 'usage: vars set <name> <value>  |  vars get <name>  |  vars del <name>',
  noVariable: (name: string) => `no variable "${name}". Type "vars" to list them, or "vars ${name}" to search.`,
  value: (name: string, shown: string) => `${name} = ${shown}`,
  notSet: (name: string) => `${name} is not set`,
  removed: (name: string, was: string) => `Removed ${name} (was ${was})`,
  changed: (name: string, shown: string, was: string | null) => `${name} = ${shown}${was === null ? '  (new)' : `  (was ${was})`}`,
  nothingReads: '  No trigger had set it yet, so nothing may read it. "vars" lists the ones in use.',
  set: Object.freeze({
    usage: 'vars set|get|del <name> [value]',
    desc: 'Change, read in full, or remove one trigger variable',
    about: Object.freeze([
      'set writes a value, get prints one in full, del removes one.',
      'Typing follows the map loader: a whole number is stored as a number, and',
      'anything else as text, so 5 is a number while 3.5, 01 and -0 stay text.',
      'Wrap it in double quotes to force text, because the "variable equals" actions',
      'compare types: 5 and "5" are not the same value to them.',
      'A value may contain spaces; everything after the name is taken as the value.',
    ]),
    args: Object.freeze([
      ['set <name> <value>', 'write it, creating the variable when it is new'],
      ['get <name>', 'print one value, never shortened'],
      ['del <name>', 'remove it (also unset, rm)'],
    ] as const),
    examples: Object.freeze([
      ['vars set var_godhuman 1', 'the number 1'],
      ['vars set var_text "1"', 'the text "1"'],
      ['vars set scale 1.5', 'text, because 1.5 is not a whole number'],
      ['vars set var_nickname some player', 'a value with spaces'],
      ['vars del var_godhuman', 'remove it again'],
    ] as const),
    notes: Object.freeze([
      'Setting a variable does not run anything: a trigger has to read it before',
      'it changes the level. "triggers find <name>" shows which ones do, and',
      '"triggers run <#>" runs one now.',
    ]),
    see: Object.freeze(['vars', 'triggers find', 'triggers run']),
  }),
});

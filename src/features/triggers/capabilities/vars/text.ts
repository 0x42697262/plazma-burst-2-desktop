export const TEXT = Object.freeze({
  row: (name: string, value: string) => `  ${name} ${value}`,
  title: (count: number, filter: string, shown: number) => `Map variables: ${count}.${filter ? ` Filter "${filter}": ${shown} shown.` : ''}`,
  command: (filter: string) => (filter ? `vars ${filter}` : 'vars'),
  noMatch: (filter: string) => `  no variable name contains "${filter}"`,
  noneYet: '  no trigger has set a variable yet',
  listHint: 'Numbers print bare and text in quotes.',
  usage: 'vars [filter] [page n]',
  desc: 'List the map\'s trigger variables and their values; a filter matches part of a name',
  clientOnly: 'the value changes in your game only; the server and the other players keep theirs',
  help: Object.freeze({
    about: Object.freeze([
      'The variables the map\'s triggers keep their state in: one name-value store,',
      'emptied whenever a map loads, so it only has the variables a trigger has',
      'touched so far. Numbers print bare and text in quotes, because the "variable',
      'equals" actions tell the two apart.',
    ]),
    args: Object.freeze([['[filter]', 'only names containing this text, ignoring case'], ['page n', 'jump to page n of a long list']] as const),
    examples: Object.freeze([
      ['vars', 'every variable with its value'],
      ['vars god', 'only names containing "god"'],
      ['vars get var_text', 'one value, never shortened'],
      ['triggers find var_text', 'the trigger actions that read or write it'],
    ] as const),
    notes: Object.freeze(['A long value is shortened in the list; "vars get <name>" prints it in full.']),
    see: Object.freeze(['vars set', 'triggers find', 'triggers']),
  }),
});

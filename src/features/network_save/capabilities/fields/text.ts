export const TEXT = Object.freeze({
  usage: 'netsave fields [filter] [page <n>]',
  desc: 'Every field of the local save with its value, to read or change with netsave set',
  about: [
    'Lists the game\'s save (localStorage) field by field, sorted by name, with each value',
    'typed: "text", a number, or true/false. A filter keeps the names that contain it.',
    'The login proof is never shown. "netsave set <name> <value>" changes one.',
  ],
  examples: [['netsave fields', 'every field'], ['netsave fields volume', 'the names with "volume" in them']],
  title: (total: number, filter: string, shown: number) => (filter ? `Save fields matching "${filter}": ${shown} of ${total}` : `Save fields: ${total}`),
  row: (name: string, value: string) => `  ${name} ${value}`,
  command: (filter: string) => (filter ? `netsave fields ${filter}` : 'netsave fields'),
  noMatch: (filter: string) => `No field matches "${filter}".`,
  noneYet: 'The save has no fields yet.',
  hint: 'netsave set <name> <value> changes one; netsave get <name> prints one in full.',
});

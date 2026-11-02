export const TEXT = Object.freeze({
  noOpcodes: 'the editor\'s action list is not loaded. Run "npm run fetch-opcodes" and restart.',
  actionsRow: (type: string, name: string, description: string, targetA: string, targetB: string) => `  ${type}  ${name} ${description}  [A: ${targetA}, B: ${targetB}]`,
  actionsTitle2: (query: string, count: number) => `${query ? `Trigger actions matching "${query}"` : 'Trigger actions'}: ${count}. Write them as Name( "A", "B" );.`,
  actionsCommand: (query: string) => `triggers actions${query ? ` ${query}` : ''}`,
  actionsNoMatch: (query: string) => `  no action matches "${query}"`,
  opName: (type: number) => `op${type}`,
});

export const HELP = Object.freeze({
  usage: 'triggers actions [text | number] [page n]',
  desc: 'The map editor\'s trigger actions: number, name for "triggers exec", what it does',
  about: Object.freeze([
    'Every trigger action the map editor knows: its number, the name its text view',
    'uses (op<number> when it has none), what it does, and what A and B are.',
    'Words filter it: all must appear in the name or the description.',
  ]),
  args: Object.freeze([['[text]', 'words in the name or description'], ['[number]', 'one action number'], ['page n', 'jump to page n']] as const),
  examples: Object.freeze([
    ['triggers actions', 'all of them'],
    ['triggers actions timer', 'everything about timers'],
    ['triggers actions 123', 'action 123'],
  ] as const),
  see: Object.freeze(['triggers exec']),

});

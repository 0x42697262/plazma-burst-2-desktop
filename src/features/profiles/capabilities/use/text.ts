export const USE_TEXT = Object.freeze({
  noMap: 'no map loaded yet: start one, or name it ("profile use <name> <map id>")',
  useUsage: 'usage: profile use <name | none> [map id]',
  noneNow: (id: string, was: string) => `Map ${id}: no profile (was "${was}"), your settings apply`,
  hadNone: (id: string) => `Map ${id} had no profile`,
  usesNow: (id: string, name: string, isNew: boolean, was: string | null, summary: string) => `Map ${id} uses profile "${name}"${isNew ? ' (new)' : ''}${was && was !== name ? `, was "${was}"` : ''}: ${summary}`,
  usage: 'profile use <name | none> [map id]',
  desc: 'This map (or that one) uses a profile, or none',
  about: ['A new name makes an empty profile. Without a map ID, the current map.'],
  args: [
    ['use <name> [map id]', 'this map (or that one) uses it; a new name makes an empty profile'],
    ['use none [map id]', 'this map uses no profile'],
  ],
  examples: [['profile use hardcore', 'this map uses "hardcore"'], ['profile use fun local-arena', 'map local-arena uses "fun"']],
  see: ['profile'],
});

export const TEXT = Object.freeze({
  runUsage: 'usage: triggers run <# | uid> [force] [as <char#>]',
  noSuchTrigger: (query: string) => `no trigger "${query}"`,
  runForceHint: (index: number) => `triggers run ${index} force`,
  ranTrigger: (label: string) => `trigger ${label}`,
});

export const HELP = Object.freeze({
  usage: 'triggers run <# | uid> [force] [as #]',
  desc: 'Run a trigger now, with you (or character #) as the activator. "force" also runs a disabled/used-up one. Multiplayer: other players see it too (not with "as", or forced on a disabled/used-up one)',
  about: Object.freeze([
    'Runs a trigger through the game\'s own function, the way a shot or a region',
    'does: the activator ("the player who started it", which many actions use) is',
    'set first.',
    'Without "force" the game\'s rules apply: the trigger must be enabled with calls',
    'left, and running uses one up. With "force" it runs anyway, and its enabled',
    'state and calls left are put back afterwards.',
  ]),
  args: Object.freeze([
    ['<# | uid>', 'which trigger'],
    ['force', 'ignore enabled and calls left, then restore them'],
    ['as <char#>', 'run it as that character (see "chars")'],
  ] as const),
  examples: Object.freeze([
    ['triggers run 12', 'by index'],
    ['triggers run #god_all', 'by uid'],
    ['triggers run 12 force', 'even when disabled or used up'],
    ['triggers run 12 as 3', 'as character #3'],
  ] as const),
  notes: Object.freeze([
    'Multiplayer: the run is sent to the server, so other players run it too.',
    'Not sent when the other clients would refuse it or run it differently: forced',
    'on a disabled or used-up trigger, "as" someone else (the server always makes',
    'the sender the activator), or while spectating. Then it runs in your game only',
    'and the console says which of those it was.',
  ]),
  see: Object.freeze(['triggers', 'triggers history', 'chars']),

});

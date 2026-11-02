export const TEXT = Object.freeze({
  runUsage: 'usage: regions run <# | uid> [force] [as <char#>]',
  noRegion: (query: string) => `no region "${query}". Type "regions" to list them.`,
  run: Object.freeze({
    usage: 'regions run <# | uid> [force] [as #]',
    desc: 'Fire a region as if its condition were met: run its trigger (or start its timer), with you (or character #) as the activator',
    about: Object.freeze([
      'Does what the game does when a region\'s condition is met, without walking into it',
      'or pressing anything: the activator is set, then the region runs its trigger, or',
      'starts its timer when it has "uses timer".',
      'The region\'s mode is checked first, as the game would for that character, apart',
      'from where they stand: a red-team use key refuses a blue player, "bot enters"',
      'refuses players, "door/elevator arrives" refuses characters. "force" fires it',
      'anyway, and also runs a disabled or used-up trigger, putting it back after.',
    ]),
    args: Object.freeze([
      ['<# | uid>', 'the region, e.g. 3 or #button (see "regions")'],
      ['force', 'past the mode\'s condition and the trigger\'s own rules'],
      ['as <char#>', 'fire it for that character (see "chars")'],
    ] as const),
    examples: Object.freeze([
      ['regions run 3', 'as if you had used region #3'],
      ['regions run #button', 'the same, by uid'],
      ['regions run 7 as 2', 'as if character #2 had walked in'],
      ['regions run 9 force', 'even when its mode would not fire for you'],
    ] as const),
    notes: Object.freeze([
      'Multiplayer: sent to the server like the game\'s own region use (with the',
      'region\'s number), so other players run the trigger too. Not sent when forced',
      'past the mode or the trigger\'s rules, "as" another character, or while',
      'spectating. A timer region is never sent: for those the game sends the',
      'timer\'s number as a trigger, which would run the wrong trigger elsewhere.',
      'Not done: the button animation and the use sound of use-key regions.',
    ]),
    see: Object.freeze(['regions', 'triggers run', 'logic']),
  }),
});

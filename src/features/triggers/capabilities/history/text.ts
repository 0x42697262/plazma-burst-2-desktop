export const TEXT = Object.freeze({
  historyCleared: 'Trigger history cleared',
  historyOff: (key: string) => `Trigger history is off ("${key} on" to record).`,
  noActivator: '-',
  ran: 'ran',
  refused: (why: string) => `refused (${why})`,
  historyRow: (ago: string, index: string, uid: string, who: string, result: string, count: number) => `  ${ago} #${index} ${uid} by ${who} ${result}${count > 1 ? ` x${count}` : ''}`,
  refusedHidden: (count: string) => ` ${count} hidden ("triggers history all").`,
  refusedNoun: 'refused attempt',
  historyTitle: (count: number, max: number, hidden: string) => `Trigger history, newest first (${count} recorded, max ${max}).${hidden}`,
  historyCommand: (filter: string) => `triggers history${filter ? ` ${filter}` : ''}`,
  historyNoMatch: (filter: string) => `  no recorded run matches "${filter}"`,
  historyEmpty: '  no trigger has run since the map loaded (or since "triggers history clear")',
  historyHint: 'Triggers that run while the map loads ("at start") are not recorded.',
});

export const HELP = Object.freeze({
  usage: 'triggers history [all | clear | # | uid] [page n]',
  desc: 'Recent trigger runs, newest first: when, which, by whom. "all" adds refused attempts (disabled / no calls left)',
  about: Object.freeze([
    'Every trigger run since the map loaded, newest first: how long ago, which',
    'trigger, who started it, and whether it ran. Attempts the game refused',
    '(disabled, or no calls left) are hidden until you ask for "all".',
  ]),
  args: Object.freeze([
    ['(nothing)', 'runs that succeeded'],
    ['all', 'refused attempts as well'],
    ['clear', 'empty the list'],
    ['<#>', 'one trigger index, refusals included'],
    ['[text]', 'only uids containing it'],
    ['page n', 'jump to page n'],
  ] as const),
  examples: Object.freeze([
    ['triggers history', 'the recent runs'],
    ['triggers history all', 'refusals too'],
    ['triggers history god', 'only uids containing "god"'],
    ['triggers history clear', 'start over'],
  ] as const),
  notes: (max: number) => [
    `Recording is the trigger_history key (on by default), and the last ${max} runs are kept.`,
    'Triggers that run while the map loads ("at start") are not recorded.',
  ],
  see: Object.freeze(['triggers', 'triggers run', 'trigger_history']),

});

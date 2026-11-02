export const TEXT = Object.freeze({
  nothing: 'nothing',
  firesTimer: (target: number, uid: string | undefined) => `timer #${target}${uid ? ` ${uid}` : ''}`,
  firesTrigger: (target: number, uid: string | undefined) => `trigger #${target}${uid ? ` ${uid}` : ''}`,
  row: (index: string, uid: string, mode: string, fires: string, atX: number, atY: number) => `  #${index} ${uid} ${mode} -> ${fires}   at ${atX}, ${atY}`,
  title: (count: number, filter: string, shown: number) => `Regions: ${count}.${filter ? ` Filter "${filter}": ${shown} shown.` : ''}`,
  command: (filter: string) => (filter ? `regions ${filter}` : 'regions'),
  empty: (filter: string) => `  no region uid contains "${filter}"`,
  usage: 'regions [filter] [page n]',
  desc: 'List the map\'s regions: how each is activated and what it fires',
  help: Object.freeze({
    about: Object.freeze([
      'Every region: its index and uid, its activation mode (use key, character enters,',
      'red player enters...), and what it fires: a trigger, or a timer when the region',
      'has "uses timer". Regions with mode "never" fire nothing themselves; they are',
      'targets for other actions, such as "move character to region".',
    ]),
    args: Object.freeze([['[filter]', 'only uids containing this text'], ['page n', 'jump to page n']] as const),
    examples: Object.freeze([
      ['regions', 'all of them'],
      ['regions door', 'uids containing "door"'],
      ['regions run 3', 'fire region #3 as if you had used it'],
    ] as const),
    see: Object.freeze(['regions run', 'logic', 'triggers']),
  }),
});

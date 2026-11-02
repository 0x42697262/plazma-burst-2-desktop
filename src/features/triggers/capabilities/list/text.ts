export const TEXT = Object.freeze({
  noTrigger: (index: number, count: number) => `no trigger #${index}. This map has ${count} (0-${count - 1}).`,
  actionRow: (action: string, type: string, targetA: string, targetB: string, name: string) => `    ${action}. type ${type} A = ${targetA}   B = ${targetB}${name}`,
  triggerTitle: (label: string) => `Trigger ${label}`,
  state: (enabled: boolean, calls: string, atStart: boolean) => `  ${enabled ? 'enabled' : 'disabled'}, calls ${calls}${atStart ? ', runs at map start' : ''}`,
  startedBy: (sources: string | null) => `  started by: ${sources ?? 'nothing found (maybe a shot at an object, or another trigger through a variable)'}`,
  actionsTitle: (count: string) => `  ${count} (type = the map editor's action number):`,
  triggerCommand: (index: number) => `triggers ${index}`,
  atStart: 'at start',
  by: (first: string, more: number) => `by ${first}${more > 0 ? ` +${more}` : ''}`,
  listRow: (index: string, uid: string, enabled: boolean, calls: string, actions: string, single: boolean, flags: string) => `  #${index} ${uid} ${enabled ? 'on ' : 'off'}  ${calls} ${actions} ${single ? 'action ' : 'actions'}  ${flags}`,
  listTitle: (count: number, on: number, filter: string, shown: number) => `Triggers: ${count} (${on} enabled, ${count - on} disabled).${filter ? ` Filter "${filter}": ${shown} shown.` : ''} "triggers <#>" shows one in detail.`,
  listCommand: (filter: string) => (filter ? `triggers ${filter}` : 'triggers'),
  noEnabled: '  no enabled triggers',
  noDisabled: '  no disabled triggers',
  noMatch: (filter: string) => `  no trigger matches "${filter}"`,
});

export const HELP = Object.freeze({
  usage: 'triggers [# | uid | on | off] [page n]',
  desc: 'List map triggers (enabled, calls left, what starts them), or one trigger\'s actions. Long lists are paged (page_size)',
  help: Object.freeze({
    about: Object.freeze([
      'A read-only view of the map\'s triggers.',
      'No argument: all of them, with what starts each one (region, timer, map start,',
      'chat). A number or uid: that trigger in full, action by action. Text: only the',
      'triggers whose uid contains it.',
    ]),
    args: Object.freeze([
      ['[#]', 'trigger index, e.g. 12 or #12'],
      ['[uid]', 'exact uid, e.g. #god_all'],
      ['[text]', 'every uid containing it'],
      ['on | off', 'only enabled, or only disabled'],
      ['page n', 'jump to page n of a long list'],
    ] as const),
    examples: Object.freeze([
      ['triggers', 'all of them'],
      ['triggers off', 'only the disabled ones'],
      ['triggers 12', 'trigger #12 in full'],
      ['triggers #god_all', 'the same, by uid'],
      ['triggers god', 'every uid containing "god"'],
    ] as const),
    notes: Object.freeze(['Long lists are paged: "more" is the next page, page_size sets the length.']),
    see: Object.freeze(['triggers find', 'triggers run', 'triggers exec', 'triggers history', 'more']),
  }),
});

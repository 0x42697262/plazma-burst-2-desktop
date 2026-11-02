export const TEXT = Object.freeze({
  actionLabel: (action: number, type: number, name: string | undefined) => `action ${action}: ${type}${name ? ` ${name}` : ''}`,
});

export const QUERY_TEXT = Object.freeze({
  noTree: 'this app shows no element as a tree',
  linkNoun: 'link',
  notReadable: 'the map text is not readable yet (it is unpacked when the level starts)',
  depthRange: (max: number) => `depth expects 1-${max}`,
  nothingCalled: (query: string) => `nothing in this map is called "${query}". Uids look like #god_all; "triggers find" lists triggers.`,
  typeCount: (type: string, count: number) => `${type} ${count}`,
  listSeparator: ', ',
  noType: (word: string, types: string) => `this map has no "${word}". Types: ${types}`,
  notTypes: (types: readonly string[]) => `not ${types.join(', ')}`,
  onlyTypes: (types: readonly string[]) => `only ${types.join(', ')}`,
  everyKind: 'every kind',
  onScreen: 'on screen',
  name: (uid: string, tag: string, index: number) => `${uid}  ${tag} #${index}`,
  at: (atX: number, atY: number) => ` at ${atX}, ${atY}`,
});

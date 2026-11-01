export const TEXT = Object.freeze({
  terminalLine: (tag: string, text: string) => `${tag} ${text}`,
  moreLines: (count: number) => `+${count} more`,
  pageExpectsNumber: 'page expects a number, e.g. "page 2"',
  pageTitle: (title: string, page: number, pages: number, from: number, to: number, total: number) => `${title} Page ${page}/${pages}: ${from}-${to} of ${total}.`,
  pageFooter: (page: number, pages: number, command: string) => `Page ${page}/${pages}. "more" = next page, "page <n>" = jump (also "${command} page <n>").`,
  lastPageFooter: (pages: number) => `Last page (${pages}/${pages}). "page 1" = back to the top.`,
  pagesStartAtOne: 'pages start at 1',
  noPage: (page: number, pages: number, suffix: string, size?: number) => `no page ${page}: this list has ${pages} page${suffix}${size === undefined ? '' : ` of ${size}`}`,
  noListYet: 'no list to page yet. Try "triggers".',
  pageUsage: 'usage: page <n>',
  alreadyLastPage: (pages: number) => `already on the last page (${pages}/${pages}). "page 1" goes back to the top.`,
});

export const PANEL_TEXT = Object.freeze({
  multiplayer: 'MULTIPLAYER',
  active: 'ACTIVE',
  idle: 'IDLE: start a level to apply',
  buttons: Object.freeze({ close: 'Close', clear: 'Clear', list: 'List values', help: 'Help' }),
  keySource: (key: string) => `key ${key}`,
  bindSource: (profile: string | null, key: string) => `${profile ? `profile ${profile} ` : ''}bind ${key}`,
});

export const ROUTE_TEXT = Object.freeze({
  notInRemotePlay: 'Network saves are not shown in remote play',
});

export const REQUEST_TEXT = Object.freeze({
  badRequest: 'expected { action: "load" | "save", url, login, password, text }',
  notAllowed: (action: string) => `${action} is off (its network_save capability)`,
  notTheSaveAddress: (url: string) => `not a network save address: ${url}`,
  noLogin: 'the page has no login: the game is not logged in',
  failed: (message: string) => `the site could not be reached: ${message}`,
});

export const SHARED_TEXT = Object.freeze({
  row: (name: string, value: string) => `  ${name} = ${value}`,
  noLogin: 'The game is not logged in (the page has no login), so it has no network save.',
  nothingOnline: (login: string, answer: string) => `${login} has no network save on the site (it answered ${JSON.stringify(answer)}).`,
  siteRefused: (status: number) => `The site answered HTTP ${status}.`,
  noWrapper: 'This needs the desktop app (its __dev/netsave route).',
});

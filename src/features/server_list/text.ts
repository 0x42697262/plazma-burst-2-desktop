export const OFFICIAL_DESCRIPTION = 'The official servers (USA, Arizona). Your PB2 account from data/credentials.json.';

export const ENTRY_TEXT = Object.freeze({
  badAddress: (text: string) => `address: "${text}" is not like "203.0.113.5:2053"`,
  portRange: (port: number) => `address: port ${port} is out of range`,
  notAnEntry: 'not a server entry',
  badFingerprint: 'fingerprint: the server\'s certificate fingerprint, as its terminal prints it (64 hex digits)',
  badNickname: 'nickname: 1-20 letters, digits, spaces and _ . -',
  badPassword: 'password: text',
  entryProblem: (index: number, errors: readonly string[]) => `server ${index}: ${errors.join('; ')}`,
  fileProblem: (file: string, message: string) => `${file}: ${message}`,
});

export const PROBE_TEXT = Object.freeze({
  noAnswer: 'no answer',
  noCertificate: 'no certificate',
  notPinned: 'the server\'s certificate is not the saved one',
  tooLong: 'answer too long',
  noStatus: 'no status (an older server?)',
  notJson: 'the status is not JSON',
});

export const SERVICE_TEXT = Object.freeze({
  notSaved: 'that server is not saved',
  noAccounts: 'accounts are not in this app',
  unknownClient: (id: string) => `no game client "${id}" in this app`,
  notSavedShort: 'not saved',
  serversFileProblem: (problem: string) => `data/servers.json: ${problem}`,
  imported: (file: string) => `Imported data/join.json into ${file}; join.json is no longer used`,
  importFailed: (message: string) => `data/join.json not imported: ${message}`,
  playing: (name: string, hostPort: string, nickname: string) => `Private server: ${name} (${hostPort}) as ${nickname}`,
  titleOfficial: 'Plazma Burst 2',
  titlePrivate: (name: string) => `Plazma Burst 2 (${name})`,
  needsNickname: (name: string) => `${name} needs a nickname: give it one with Edit first`,
  seeded: (count: number, file: string) => `Added ${count} server${count === 1 ? '' : 's'} from this app's defaults to ${file}`,
  passwordDropped: (name: string) => `Private server ${name}: its address or certificate changed, so its saved password was dropped (enter it again with Edit)`,
});

export const ROUTE_TEXT = Object.freeze({
  notAvailable: 'Not available',
  postOnly: 'POST { op, arg }',
  invalidJson: 'Invalid JSON',
  unknownOperation: 'unknown op',
  notAllowed: 'not allowed here',
});

export const COMMAND_TEXT = Object.freeze({
  wrapperOnly: 'the server list is in the desktop wrapper only',
  notInThisWindow: 'the server list is not available in this window',
  unknownKey: (key: string, fields: readonly string[]) => `unknown "${key}=". Use ${fields.map((field) => `${field}=`).join(' ')}`,
  notPairs: (rest: string) => `"${rest}" is not key=value (a value with spaces goes in "quotes")`,
  whichServer: 'which server? "official", its number in the list, or its name',
  noServer: (number: string) => `no server ${number}`,
  ambiguous: (word: string, names: readonly string[]) => `"${word}" could be ${names.join(', ')}`,
  notSaved: (word: string) => `no saved server "${word}"`,
  errorLine: (message: string) => `error: ${message}`,
  fetchNeedsAddress: 'fingerprint=fetch needs address=',
  fetchedFingerprint: (fingerprint: string) => `The server shows fingerprint ${fingerprint}. Compare it with the one the host sent you.`,
  saved: (what: string, name: string, address: string, nickname: string, hasPassword: boolean) => `${what} ${name} (${address}, as ${nickname}${hasPassword ? ', password saved' : ''}).`,
  passwordNote: 'A typed password= is kept out of the history and the log.',
});

export const JOIN_TEXT = Object.freeze({
  location: (address: string) => `Private server, ${address}`,
  failed: (message: string) => `Private server: ${message}`,
  started: (address: string, nickname: string) => `Private server ${address}: Multiplayer connects there, as ${nickname}.`,
});

export const LAUNCHER_TEXT = Object.freeze({
  checking: '…',
  offline: 'offline',
  pingMs: (milliseconds: number) => `${milliseconds} ms`,
  noPlayers: '—',
  players: (players: number, max: number, matches: number) => `${players}/${max}${matches ? ` · ${matches} match${matches === 1 ? '' : 'es'}` : ''}`,
  asNickname: (nickname: string) => `as ${nickname}`,
  certificateChanged: 'Its certificate is not the saved one. Someone else may be at this address; ask the host for the fingerprint again.',
  notReachable: 'not reachable',
  versionMismatch: (there: string, here: string) => `Game ${there} there, ${here} here: the same version is needed ("npm run fetch-game" on both).`,
  asNicknameNeedsPassword: (nickname: string, needsPassword: boolean) => `${nickname ? `as ${nickname}` : 'needs a nickname (Edit)'}${needsPassword ? ' · needs a password (Edit)' : ''}`,
  needsNickname: 'needs a nickname (Edit)',
  officialTag: 'official',
  privateTag: 'private',
  fileProblems: (problems: readonly string[]) => `data/servers.json: ${problems.join('; ')}`,
  editTitle: (name: string) => `Edit ${name}`,
  addTitle: 'Add a private server',
  passwordUnchanged: '(unchanged)',
  fingerprintFetched: 'Got it from the server. Compare it with the fingerprint the host sent you before saving.',
  fingerprintFailed: (message: string) => `Could not get the fingerprint: ${message}`,
  confirmRemove: (name: string) => `Remove ${name} from the list?`,
  otherClients: 'Also in this app: ',
  playClient: (title: string) => `Play ${title}`,
  outsideApp: 'This page only works inside the desktop app (npm start).',
});

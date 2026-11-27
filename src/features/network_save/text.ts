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

export const BACKUP_ROUTE_TEXT = Object.freeze({
  badBackup: 'expected { kind: "local" | "online", login, reason, data | text }',
  noSuchBackup: (id: string) => `no backup ${id}`,
  off: 'backups are off (capabilities network_save.upload, direct and restore)',
});

export const BACKUP_TEXT = Object.freeze({
  beforeUpload: 'before an upload',
  beforeRestore: 'before a restore',
  beforeBackupRestore: 'before restoring a backup',
  onlineKept: 'A backup of the network save from before was kept (see the list of backups).',
  nothingOnlineToKeep: 'The site had no network save for this account, so there was none to back up.',
  backupFailed: (message: string) => `Could not back up the network save first, so nothing was uploaded: ${message}`,
  siteRefused: (status: number) => `the site answered HTTP ${status}`,
});

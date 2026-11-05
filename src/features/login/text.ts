export const TEXT = Object.freeze({
  unreadable: (file: string, message: string) => `Could not parse ${file}: ${message}`,
  cleared: (names: readonly string[]) => `Cleared saved site cookies: ${names.join(', ')}`,
  loggedIn: (names: readonly string[]) => `Logged in from credentials: ${names.join(', ')}`,
  loggedOut: 'No credentials (data/credentials.json or PB2_LOGIN/PB2_PASSWORD/PB2_UID): starting logged out.',
  notEncrypted: 'This system has no keychain for the app: saved accounts stay readable only by your user, not encrypted.',
  cannotOpen: (login: string) => `Could not read the saved login of ${login}: log in to it again.`,
  noAccount: (login: string) => `No saved account "${login}"`,
  loginOff: 'Login is off (feature flag "login"): starting logged out.',
});

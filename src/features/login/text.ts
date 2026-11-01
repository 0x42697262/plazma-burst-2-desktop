export const TEXT = Object.freeze({
  unreadable: (file: string, message: string) => `Could not parse ${file}: ${message}`,
  cleared: (names: readonly string[]) => `Cleared saved site cookies: ${names.join(', ')}`,
  clearedPrivate: (names: readonly string[]) => `Cleared saved site cookies: ${names.join(', ')} (your PB2 account is not used on a private server)`,
  loggedIn: (names: readonly string[]) => `Logged in from credentials: ${names.join(', ')}`,
  loggedOut: 'No credentials (desktop/credentials.json or PB2_LOGIN/PB2_PASSWORD/PB2_UID): starting logged out.',
  loginOff: 'Login is off (feature flag "login"): starting logged out.',
});

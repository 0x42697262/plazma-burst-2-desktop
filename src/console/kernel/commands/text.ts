export const TEXT = Object.freeze({
  usage: 'features',
  description: 'Every feature flag: on or off, and why (read-only)',
  about: [
    'Feature flags are set before the game starts: features.json at the repository root, or PB2_FEATURES=+id,-id.',
    'The page cannot change them. "npm start -- --features" prints the same list in the terminal.',
  ],
  noArguments: 'usage: features',
  title: 'Feature flags',
});

export const COMMAND_TEXT = Object.freeze({
  unknownStart: (first: string, part: string) => `unknown command "${first}"${part !== first ? ` in "${part}"` : ''}. Type "help".`,
  hotkeyWins: (key: string, what: string, setting: string) => `  ${key} is ${what}, which wins: "${setting} <other key>" or "${setting} off" frees it.`,
  gameKey: (key: string, base: string, use: string) => `  ${key} is also a game key (${base ? `${base}: ` : ''}${use}). In levels the bind runs instead.`,
});

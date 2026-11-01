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

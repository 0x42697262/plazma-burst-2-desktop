export const TEXT = Object.freeze({
  terminal: (tag: string, message: string) => `${tag} ${message}`,
  banner: (title: string) => `${title} dev console. Type "help". Toggle with Shift+\` (~).`,
  namesMissing: (names: readonly string[], findNames: string) => `Game names not found: ${names.join(', ')}. Commands that use them will fail. Run "${findNames}" (see README.md).`,
  loaded: (overrides: string, binds: string, profiles: string, from: string) => `Loaded ${overrides}, ${binds}${profiles ? ` and ${profiles}` : ''} from ${from}.`,
  overrideNoun: 'override',
  bindNoun: 'bind',
  profileNoun: 'profile',
  fileProblem: (file: string, problem: string) => `${file}: ${problem}`,
  reloaded: (file: string) => `${file} changed: reloaded`,
  unreadable: (file: string, message: string) => `${file} changed but cannot be read (${message}). Keeping the settings from before, and not saving changes to the file until it is fixed.`,
});

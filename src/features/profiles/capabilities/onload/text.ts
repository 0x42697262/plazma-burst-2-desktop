export const ONLOAD_TEXT = Object.freeze({
  onloadUsage: 'usage: profile onload <name> <command>  |  profile onload <name> --clear',
  onloadShown: (name: string, command: string) => `${name} onload: ${command}`,
  runsNothing: (name: string) => `${name} runs nothing on load`,
  onloadCleared: (name: string) => `${name}: runs nothing on load now`,
  onloadWhen: (name: string) => `  runs each time a level starts on a map using "${name}"`,
  usage: 'profile onload <name> [command | --clear]',
  desc: 'Commands to run each time a level starts on the profile\'s maps',
  about: ['Without a command, shows it. Quote a ";" chain, as with "bind".', 'Runs as the level starts: joining a match, or starting or restarting the level.'],
  examples: [['profile onload paulbase "vars set name_color \\"#78dbe2\\"; vars sync name_color r"', 'every time a level on them starts']],
  see: ['profile'],
});

export const TEXT = Object.freeze({
  usage: 'Usage: npm run release -- --edition <name> [--linux] [--windows]\n  Builds the edition (editions/<name>.json) and packages it into release/<name>/.\n  Without --linux or --windows, packages for the system it runs on.',
  noEdition: 'Which edition? --edition <name> (the files in editions/)',
  everyFeature: 'This edition has every feature (the dev console, hooks, js …). Release it anyway? It is meant for development.',
  building: (name: string, features: readonly string[]) => `Edition "${name}": ${features.join(', ')}`,
  added: (reason: string) => `  added ${reason}`,
  packaging: (platforms: readonly string[], folder: string) => `Packaging for ${platforms.join(', ')} into ${folder}`,
  done: (files: readonly string[]) => `Done:\n  ${files.join('\n  ')}`,
  unknownArgument: (arg: string) => `unknown argument: ${arg}`,
});

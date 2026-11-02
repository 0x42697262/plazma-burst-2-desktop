export const TEXT = Object.freeze({
  watching: 'Watching the console sources; the bundle is rebuilt on every change. Ctrl+C stops.',
  built: (output: string) => `Built ${output}`,
  edition: (name: string, features: readonly string[], capabilities: readonly string[] | null) => `Edition "${name}": ${features.join(', ')}${capabilities ? `\n  capabilities: ${capabilities.join(', ')}` : ''}`,
  editionProblems: (name: string, problems: readonly string[]) => `Edition "${name}" cannot be built:\n  ${problems.join('\n  ')}`,
  addThese: (missing: readonly string[]) => `Add to its "features": ${missing.map((id) => JSON.stringify(id)).join(', ')}`,
  editionUnreadable: (file: string, message: string) => `${file}: ${message}`,
  nameMismatch: (file: string, name: string) => `${file}: "name" is "${name}", but must be the file's name`,
  editionModule: (json: string) => `export const EDITION = Object.freeze(${json});\n`,
  stillUsed: (file: string, name: string) => `${file}: ${name} is left out of this edition but still used`,
  oneOffTitle: 'Plazma Burst 2 (custom)',
  oneOffAppId: 'io.github.plazma-burst-2-desktop.custom',
});

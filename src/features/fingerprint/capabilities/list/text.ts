export const LIST_TEXT = Object.freeze({
  usage: 'fingerprint list',
  description: 'Every fingerprinter version saved in data/fingerprint/, the latest first',
  about: [
    'A version is the code without its values (strings, numbers): one the server',
    'changed. Its file holds the newest text, with the last session\'s values.',
  ],
  see: ['fingerprint'],
  none: 'No fingerprinter saved yet in data/fingerprint/.',
  title: (count: number) => `Fingerprinter versions in data/fingerprint/ (${count}), the latest first. "fingerprint" runs the latest.`,
  latestMark: 'latest',
  notLatestMark: '      ',
  row: (id: string, mark: string, kind: string, chars: string, seen: string, first: string, ago: string, file: string) => `  ${id}  ${mark}  ${kind}  ${chars} chars  seen ${seen}x  first ${first}, last ${ago}  ${file}`,
  failed: (message: string) => `error: could not list the fingerprinters: ${message} (desktop wrapper only)`,
  examples: [['fingerprint list', 'every version saved']],
  usageError: 'usage: fingerprint list',
});

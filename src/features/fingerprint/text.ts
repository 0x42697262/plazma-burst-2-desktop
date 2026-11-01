const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`;

export const STORE_TEXT = Object.freeze({
  expectedSource: 'expected the fingerprinter\'s source',
  tooLong: (max: number) => `at most ${max} characters`,
  kindChoice: (kinds: readonly string[]) => `kind: ${kinds.join(' or ')}`,
  fileName: (stamp: string, id: string, extension: string) => `${stamp}_${id}${extension}`,
  relativeFile: (folder: string, file: string) => `${folder}/${file}`,
  savedLog: (id: string, isNew: boolean, file: string) => `Fingerprinter ${id} ${isNew ? 'saved' : 'updated'}: ${file}`,
});

export const ROUTE_TEXT = Object.freeze({
  notInRemotePlay: 'not available in remote play',
  noneSaved: 'no fingerprinter saved yet',
});

export const CAPTURE_TEXT = Object.freeze({
  newVersion: (id: string, file: string) => `The server sent a new fingerprinter (version ${id}): saved to ${file}. "fingerprint" runs it.`,
  notSaved: (message: string) => `[pb2dev] fingerprinter not saved: ${message}`,
  tickName: 'Fingerprinter',
});

export const LABEL = Object.freeze({
  full: (count: number) => `fingerprint, full (${plural(count, 'value')})`,
  hardwareOnly: (count: number) => `fingerprint, hardware only (${plural(count, 'value')})`,
  buildTag: 'build tag (its argument v)',
  ipWritten: 'IP address (the server\'s view, in the source)',
  ip: 'IP address',
  token: 'token (the server wrote it into the source)',
  origin: 'page origin',
  timeZone: 'time zone',
  hash: 'fingerprint hash (MurmurHash3, base 36)',
});

export const COMMAND_TEXT = Object.freeze({
  usage: 'fingerprint [--raw] | fingerprint list',
  usageError: 'usage: fingerprint [--raw] | fingerprint list',
  listUsageError: 'usage: fingerprint list',
  description: 'Run the latest fingerprinter the main server sent and show what the game answers',
  about: [
    'The main server sends the game a browser fingerprinter (JavaScript, RELIABLE_TASK;',
    'docs/research/fingerprinting.md), which the game runs and answers. Every version that arrives is',
    'saved once in data/fingerprint/ (not in git); a version seen again is not saved again.',
    '"fingerprint" runs the latest here, as the game does, and shows the answer: each',
    'value labelled from what it is, the fingerprint\'s JSON one value a line. The',
    'fingerprinter joins its values into one text with a separator the server picks',
    'each session; they are split here by the separator in the source.',
    'Code from a private server\'s lobby is never saved here.',
  ],
  args: [['--raw', 'the parts exactly as the game would send them, in quotes, not split']],
  examples: [
    ['fingerprint', 'what the server learns about this machine'],
    ['fingerprint --raw', 'the answer as sent'],
    ['fingerprint list', 'every version saved'],
  ],
  notes: [
    'Nothing is sent: the answer is only shown. The source can hold values the server',
    'wrote into it (your IP address as it saw it, tokens); those are from when it was saved.',
    'Desktop wrapper only: the wrapper keeps the files.',
  ],
  noneSaved: 'No fingerprinter saved yet. The main server sends it after you log in to multiplayer; it is saved then.',
  header: (id: string, file: string, kind: string, chars: number, seen: number, ago: string, versions: number) => `Fingerprinter ${id} (${file}): ${kind}, ${chars} chars, seen ${plural(seen, 'time')}, last ${ago}`
    + `${versions > 1 ? `; ${versions} versions saved ("fingerprint list")` : ''}.`,
  noAnswer: 'It returned no string, number, boolean or array: the game would send no answer.',
  answerTitle: (parts: number, values: number | null, separator: string | null, codePoint: string) => `The game would answer with ${plural(parts, 'part')} (RESPONSE, callback ID, then these)`
    + `${values !== null && separator !== null ? `: one text, ${plural(values, 'value')} joined by "${separator}" (${codePoint}, this session's separator)` : ''}:`,
  rawPart: (index: number, text: string) => `  [${index}] ${JSON.stringify(text)}`,
  valueLine: (index: number, label: string, text: string) => `  [${index}] ${label} ${text}`,
  objectTitle: (index: number, label: string) => `  [${index}] ${label}`,
  objectEntry: (key: string, value: string) => `        ${key} ${value}`,
  footnote: 'Values the server wrote into the source (the IP address, tokens) are from when it was saved. Nothing was sent.',
  runFailed: (message: string) => `error: could not run the fingerprinter: ${message}`,
  notAFunction: (file: string) => `${file} is not a function`,
  asyncTimeout: (seconds: number) => `no answer after ${seconds} s`,
  list: Object.freeze({
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
  }),
});

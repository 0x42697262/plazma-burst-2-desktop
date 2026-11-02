const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`;

export const RUN_TEXT = Object.freeze({
  usage: 'fingerprint [--raw]',
  usageError: 'usage: fingerprint [--raw]',
  description: 'Run the latest fingerprinter the main server sent and show what the game answers',
  about: [
    'The main server sends the game a browser fingerprinter (JavaScript, RELIABLE_TASK;',
    'docs/research/fingerprinting.md), which the game runs and answers. Every version that arrives is',
    'saved once in data/fingerprint/ (not in git); a version seen again is not saved again.',
    '"fingerprint" runs the latest here, as the game does, and shows the answer: each',
    'value labeled from what it is, the fingerprint\'s JSON one value a line. The',
    'fingerprinter joins its values into one text with a separator the server picks',
    'each session; they are split here by the separator in the source.',
    'Code from a private server\'s lobby is never saved here.',
  ],
  args: [['--raw', 'the parts exactly as the game would send them, in quotes, not split']],
  examples: [
    ['fingerprint', 'what the server learns about this machine'],
    ['fingerprint --raw', 'the answer as sent'],
  ],
  notes: [
    'Nothing is sent: the answer is only shown. The source can hold values the server',
    'wrote into it (your IP address as it saw it, tokens); those are from when it was saved.',
    'Desktop wrapper only: the wrapper keeps the files.',
  ],
  noneSaved: 'No fingerprinter saved yet. The main server sends it after you log in to multiplayer; it is saved then.',
  header: (id: string, file: string, kind: string, chars: number, seen: number, ago: string, versions: number) => `Fingerprinter ${id} (${file}): ${kind}, ${chars} chars, seen ${plural(seen, 'time')}, last ${ago}`
    + `${versions > 1 ? `; ${versions} versions saved` : ''}.`,
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
});

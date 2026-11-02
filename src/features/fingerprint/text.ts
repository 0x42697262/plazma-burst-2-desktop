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

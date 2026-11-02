export const SCAN_TEXT = Object.freeze({
  codes: Object.freeze({ 1: 'a registered array was replaced', 2: 'a function changed', 3: 'a locked array changed' } as Readonly<Record<string, string>>),
  unknownCode: 'unknown code',
  lockedArray: (code: string, what: string, detail: string, count: string, name: string | null) => `code ${code} (${what}): locked array ${detail} of ${count}${name ? ` (${name})` : ''}`,
  other: (code: string, what: string, detail: string) => `code ${code} (${what}): ${detail}`,
  reported: (description: string) => `[anti-cheat] scan report sent, the page reloads in 300 ms: ${description}`,
});

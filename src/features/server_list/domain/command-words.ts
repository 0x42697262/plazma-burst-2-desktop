import { NUMBER_WORD, OFFICIAL_ID, OFFICIAL_NUMBER, PAIR_PATTERN, SERVER_FIELDS, skipWords } from '../keys.ts';
import { COMMAND_TEXT } from '../text.ts';

export type ListedServer = { id: string; name: string; address: string; fingerprint?: string; nickname?: string; hasPassword?: boolean };
export type OfficialServer = { id: string; name: string; host: string; port: number; description: string };
export type ServerList = { official: OfficialServer; servers: ListedServer[]; last: string | null; gameVersion: string | null; problems: string[] };
export type Picked = (ListedServer & { official?: false }) | (OfficialServer & { official: true });

export function parsePairs(text: string): Record<string, string> {
  const pairs: Record<string, string> = {};
  let rest = text;
  for (const match of text.matchAll(PAIR_PATTERN)) {
    const written = match[1] ?? '';
    const key = written.toLowerCase();
    if (!SERVER_FIELDS.includes(key)) throw new Error(COMMAND_TEXT.unknownKey(written, SERVER_FIELDS));
    pairs[key] = match[2] ?? match[3] ?? '';
    rest = rest.replace(match[0], '');
  }
  if (rest.trim()) throw new Error(COMMAND_TEXT.notPairs(rest.trim()));
  return pairs;
}

export const textAfterWords = (rest: string, count: number): string => rest.trim().replace(skipWords(count), '');

export function pickServer(list: ServerList, word: string | undefined): Picked {
  if (!word) throw new Error(COMMAND_TEXT.whichServer);
  const lower = word.toLowerCase();
  if (lower === OFFICIAL_ID || lower === OFFICIAL_NUMBER) return { ...list.official, official: true };
  if (NUMBER_WORD.test(lower)) {
    const numbered = list.servers[Number(lower) - 1];
    if (numbered) return numbered;
    throw new Error(COMMAND_TEXT.noServer(lower));
  }
  const exact = list.servers.filter((server) => server.name.toLowerCase() === lower || server.address.toLowerCase() === lower);
  const [onlyExact] = exact;
  if (exact.length === 1 && onlyExact) return onlyExact;
  const starting = list.servers.filter((server) => server.name.toLowerCase().startsWith(lower) || server.address.toLowerCase().startsWith(lower));
  const [onlyStarting] = starting;
  if (starting.length === 1 && onlyStarting) return onlyStarting;
  throw new Error(starting.length ? COMMAND_TEXT.ambiguous(word, starting.map((server) => server.name)) : COMMAND_TEXT.notSaved(word));
}

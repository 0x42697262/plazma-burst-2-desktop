import { WRONG_LINKS_MAX, WRONG_LINKS_WINDOW_MS } from '../constants.ts';

type Tally = { count: number; since: number };
export type WrongLinkNote = 'first' | 'limit' | 'quiet';

export function createWrongLinks(now: () => number = () => Date.now()) {
  const tallies = new Map<string, Tally>();

  function isLimited(address: string): boolean {
    const tally = tallies.get(address);
    if (tally && now() - tally.since > WRONG_LINKS_WINDOW_MS) tallies.delete(address);
    return (tallies.get(address)?.count ?? 0) >= WRONG_LINKS_MAX;
  }

  function note(address: string): WrongLinkNote {
    const tally = tallies.get(address) ?? { count: 0, since: now() };
    tally.count++;
    tallies.set(address, tally);
    if (tally.count === 1) return 'first';
    return tally.count === WRONG_LINKS_MAX ? 'limit' : 'quiet';
  }

  return { isLimited, note };
}

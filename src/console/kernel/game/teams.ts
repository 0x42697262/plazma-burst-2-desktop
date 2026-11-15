import { TEAM_SUFFIX } from './keys.ts';

export type TeamEntry = Readonly<{ team: number; name: string; key: string }>;

export const teamEntries = (teamNames: readonly unknown[]): TeamEntry[] => teamNames.flatMap((name, team) => (typeof name === 'string' && name
  ? [{ team, name, key: name.toLowerCase().replace(TEAM_SUFFIX, '') }]
  : []));

export function teamsMatching(word: string, teamNames: readonly unknown[]): TeamEntry[] {
  const wanted = word.toLowerCase();
  const entries = teamEntries(teamNames);
  const exact = entries.filter((entry) => entry.key === wanted || entry.name.toLowerCase() === wanted);
  return exact.length ? exact : entries.filter((entry) => entry.key.startsWith(wanted));
}

export const teamLabel = (team: unknown, teamNames: readonly unknown[]): string => {
  const name = teamNames[Number(team)];
  return typeof name === 'string' && name ? name : String(team);
};

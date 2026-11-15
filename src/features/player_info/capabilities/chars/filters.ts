import { KIND, KIND_WORDS, TEAM_SUFFIX } from './keys.ts';
import { TEXT } from './text.ts';

export type CharFilter = { kind: string | null; teams: ReadonlySet<number> };
type TeamEntry = { team: number; name: string; key: string };

const teamEntries = (teamNames: readonly unknown[]): TeamEntry[] => teamNames.flatMap((name, team) => (typeof name === 'string' && name
  ? [{ team, name, key: name.toLowerCase().replace(TEAM_SUFFIX, '') }]
  : []));

export function teamsMatching(word: string, teamNames: readonly unknown[]): TeamEntry[] {
  const wanted = word.toLowerCase();
  const entries = teamEntries(teamNames);
  const exact = entries.filter((entry) => entry.key === wanted || entry.name.toLowerCase() === wanted);
  return exact.length ? exact : entries.filter((entry) => entry.key.startsWith(wanted));
}

export function parseFilters(args: readonly string[], teamNames: readonly unknown[], fixedKind: string | null): CharFilter {
  let kind = fixedKind;
  const teams = new Set<number>();
  for (const word of args) {
    const wordKind = KIND_WORDS[word.toLowerCase()];
    if (wordKind) {
      if (kind && kind !== wordKind) throw new Error(TEXT.bothKinds);
      kind = wordKind;
      continue;
    }
    const matches = teamsMatching(word, teamNames);
    if (!teamNames.length) throw new Error(TEXT.noTeamNames(word));
    if (!matches.length) throw new Error(TEXT.unknownFilter(word, teamEntries(teamNames).map((entry) => entry.key)));
    if (matches.length > 1) throw new Error(TEXT.ambiguousTeam(word, matches.map((entry) => entry.name)));
    for (const entry of matches) teams.add(entry.team);
  }
  return { kind, teams };
}

export function passes(filter: CharFilter, team: unknown, isHuman: boolean): boolean {
  if (filter.kind === KIND.players && !isHuman) return false;
  if (filter.kind === KIND.bots && isHuman) return false;
  return !filter.teams.size || filter.teams.has(Number(team));
}

export const teamLabel = (team: unknown, teamNames: readonly unknown[]): string => {
  const name = teamNames[Number(team)];
  return typeof name === 'string' && name ? name : String(team);
};

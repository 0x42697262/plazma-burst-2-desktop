import { teamEntries, teamsMatching } from '#console/kernel/game/teams.ts';
import { KIND, KIND_WORDS } from './keys.ts';
import { TEXT } from './text.ts';

export { teamLabel } from '#console/kernel/game/teams.ts';

export type CharFilter = { kind: string | null; teams: ReadonlySet<number> };

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

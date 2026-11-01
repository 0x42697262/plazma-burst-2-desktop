export const LAYER = 'trace';
export const LIST_SECTION = 'trace';
export const TRACE_KIND = Object.freeze({ players: 'players', npc: 'npc' });
export type TraceKind = typeof TRACE_KIND[keyof typeof TRACE_KIND];
export const TRACE_SIDE = Object.freeze({ team: 'team', enemies: 'enemies' });
export type TraceSide = typeof TRACE_SIDE[keyof typeof TRACE_SIDE];
export const NO_ACCOUNT: readonly string[] = Object.freeze(['', '.guest']);
export const slotPerson = (index: number, nickname: unknown): string => `#${index} ${String(nickname)}`;
export const accountPerson = (login: string): string => `@${login}`;
export const OPTION = Object.freeze({ all: 'all', players: 'players', npc: 'npc', team: 'team', enemies: 'enemies', off: 'off' });
export const COMMAND = Object.freeze({ name: 'trace', aliases: ['tracer', 'track'] });
export const NAME_LIST_SEPARATOR = ',';
export const WORD_SEPARATOR = ' ';
export const OPTION_PREFIX = '--';
export const OLD_WORDS: Readonly<Record<string, string>> = Object.freeze({
  all: '--all', off: '--off', stop: '--off', clear: '--off',
  players: '--players', npc: '--npc', bots: '--npc', team: '--team', enemies: '--enemies',
});
export const CHARS_HINT = / Type "chars"\.$/;
export const AXES = Object.freeze(['x', 'y'] as const);

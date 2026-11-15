export const KIND = Object.freeze({ players: 'players', bots: 'bots' });
export const KIND_WORDS: Readonly<Record<string, string>> = Object.freeze({
  players: KIND.players, player: KIND.players, bots: KIND.bots, bot: KIND.bots,
});
export const ARGUMENT_JOIN = ' ';

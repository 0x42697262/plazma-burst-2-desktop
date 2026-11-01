export const REASON = Object.freeze({
  hp: 'the server reports HP above the map\'s limit as "HealthAltering" (docs/research/anticheat.md §14.4)',
  aim: 'zoomed out you can aim outside the normal view, which the server announces to the other players (docs/research/anticheat.md §14.6)',
});
export const BYPASS_HINT = '"bypass checks" turns this protection off (dangerous)';

export const TEXT = Object.freeze({
  refused: (what: string, reason: string) => `refused in a ranked match: ${what}: ${reason}. ${BYPASS_HINT}.`,
  notApplying: (keys: string) => `Ranked match: not applying ${keys}: ${REASON.hp}. Your saved values are kept. ${BYPASS_HINT}.`,
});

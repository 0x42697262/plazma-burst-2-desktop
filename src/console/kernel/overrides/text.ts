export const REASON = Object.freeze({
  hp: 'the server reports HP above the map\'s limit as "HealthAltering" (docs/research/anticheat.md §14.4)',
  aim: 'zoomed out you can aim outside the normal view, which the server announces to the other players (docs/research/anticheat.md §14.6)',
});

export const TEXT = Object.freeze({
  refused: (what: string, reason: string, hint: string) => `refused in a ranked match: ${what}: ${reason}.${hint ? ` ${hint}.` : ''}`,
  notApplying: (keys: string, hint: string) => `Ranked match: not applying ${keys}: ${REASON.hp}. Your saved values are kept.${hint ? ` ${hint}.` : ''}`,
});

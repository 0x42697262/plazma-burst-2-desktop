export const STATUS_TEXT = Object.freeze({
  usage: 'bypass',
  desc: 'Whether the console\'s protection in approved, ranked matches is on',
  statusUsage: 'usage: bypass',
  off: 'Protection: OFF. Nothing is held back in ranked matches.',
  on: (inRanked: boolean) => `Protection: on. In approved, ranked matches${inRanked ? ' (you are in one now)' : ''} the console holds back what the match's server checks:`,
  onUntouched: '  Unranked matches, unapproved maps and single-player are not touched.',
  onWhat: '  raising your HP (max_hp, hp_bonus, hp_bonus_pct, game god, game grow) and zooming out.',
  onSee: 'Server-side checks: docs/research/anticheat.md section 14.',
  about: [
    'In an approved, ranked match the console holds back what the match\'s server checks',
    '(server-side checks, docs/research/anticheat.md section 14): raising your HP above your normal',
    'max, and zooming out. Typing them is refused, and a setting you already had is not',
    'applied there (it is kept for other matches and single-player). Unranked matches',
    'and unapproved maps are not touched.',
  ],
  examples: [['bypass', 'whether the protection is on']],
  see: ['max_hp', 'zoom'],
});

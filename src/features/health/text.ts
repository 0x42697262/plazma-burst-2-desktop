import { CLIENT_ONLY_REASON } from '#console/kernel/state/schema.ts';

const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`;
export const CLIENT_ONLY = CLIENT_ONLY_REASON as string;

export const TEXT = Object.freeze({
  plural,
  bonusNone: 'none',
  bonusSeparator: ' ',
  percentBonus: (value: string) => `${value}%`,
  maxHpPreview: (now: number, next: number, base: number, bonus: string) => `  max HP ${now} -> ${next} (game ${base}, bonus ${bonus})`,
  removedNote: ' (removed)',
  repaired: (count: number) => `  repaired ${plural(count, 'broken body part')}`,
  refusedRevive: (index: number, broken: number) => `the game refused to revive #${index}${broken ? ` (${plural(broken, 'body part')} still broken)` : ''}`,
  failureCanceled: '  level failure canceled',
  reviveUsage: 'usage: revive  |  revive <#>  |  revive --all',
  reviveFailed: (index: number, message: string) => `  #${index}: ${message}`,
  revivedCount: (count: number) => `Revived ${plural(count, 'character')}`,
  nobodyDown: 'Nobody is down',
  notDown: (whoIs: string) => `${whoIs} not down`,
  revived: (who: string, hp: number) => `Revived ${who} (HP ${hp})`,
  down: 'you are down; use "revive"',
  healed: (hp: unknown) => `HP = ${String(hp)}`,
  needsSign: (raw: string) => `use a sign: "hp +${raw}" or "hp -${raw}"`,
  heal: { usage: 'heal', desc: 'Refill HP', about: ['Refills your HP to your current max. Needs a level, and refuses while you', 'are down, because the body has to be stood up first ("revive").'], see: ['revive', 'hp', 'max_hp'] },
  hp: {
    usage: 'hp <n> | hp +n | hp -n%',
    desc: 'Set max HP to n, or add/remove n or n% once (no stacking per frame or per level)',
    about: [
      'Three things in one, all of them keys underneath:',
      '  hp <n>     sets max_hp, an exact max HP',
      '  hp +n      adds a flat bonus (hp_bonus)',
      '  hp +n%     adds a percentage of the game\'s own max (hp_bonus_pct)',
      'A bonus applies once per life and per level, so it never stacks. While max_hp',
      'is set, "hp +n" raises that number instead of the bonus.',
    ],
    examples: [['hp 500', 'max HP is exactly 500'], ['hp +100', '100 more than the map gives you'], ['hp -25%', 'a quarter less'], ['hp +0', 'back to no bonus (removes the key)']],
    notes: ['A relative change needs its sign: "hp 50%" is refused, "hp +50%" is not.'],
    see: ['max_hp', 'hp_bonus', 'hp_bonus_pct', 'heal'],
  },
  revive: {
    usage: 'revive [# | --all]',
    desc: 'Revive yourself, character # (see "chars"), or every dead character',
    about: [
      'Stands the body up where it lies and refills HP, the way a defibrillator',
      'does. A destroyed head is repaired first, because the game refuses to revive',
      'without one. Also cancels the "level failed" screen.',
    ],
    args: [['(nothing)', 'you'], ['<#>', 'a character index from "chars"'], ['--all', 'everyone who is down ("all" works too)']],
    examples: [['revive', 'yourself'], ['revive 3', 'character #3'], ['revive --all', 'every downed character']],
    see: ['chars', 'heal'],
  },
});

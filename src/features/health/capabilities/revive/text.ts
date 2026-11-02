import { CLIENT_ONLY_REASON } from '#console/kernel/state/schema.ts';

const plural = (count: number, word: string): string => `${count} ${word}${count === 1 ? '' : 's'}`;
export const CLIENT_ONLY = CLIENT_ONLY_REASON as string;

export const TEXT = Object.freeze({
  plural,
  repaired: (count: number) => `  repaired ${plural(count, 'broken body part')}`,
  refusedRevive: (index: number, broken: number) => `the game refused to revive #${index}${broken ? ` (${plural(broken, 'body part')} still broken)` : ''}`,
  failureCanceled: '  level failure canceled',
  reviveUsage: 'usage: revive  |  revive <#>  |  revive --all',
  reviveFailed: (index: number, message: string) => `  #${index}: ${message}`,
  revivedCount: (count: number) => `Revived ${plural(count, 'character')}`,
  nobodyDown: 'Nobody is down',
  notDown: (whoIs: string) => `${whoIs} not down`,
  revived: (who: string, hp: number) => `Revived ${who} (HP ${hp})`,
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

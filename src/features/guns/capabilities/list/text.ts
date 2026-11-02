import { MAX_UPGRADE } from '../../constants.ts';

export const TEXT = Object.freeze({
  kindTitle: (kind: string, count: number) => `[${kind}] ${count}`,
  row: (number: string, model: string, slot: string, name: string) => `  ${number}${model}slot ${slot}${name}`,
  noneMatch: (filter: string) => `No gun matches "${filter}"`,
  giveHint: `Give one with: give <# | model | part of name> [upgrade 0-${MAX_UPGRADE}]`,
  guns: Object.freeze({
    usage: 'guns [filter]',
    desc: 'List every gun model, including community (custom) guns',
    about: [
      'Every gun the game can build, read from its own gun factory, in three',
      'groups: standard, custom (community) and items. The # is what "give" takes,',
      'and the slot is fixed per gun.',
    ],
    args: [['[filter]', 'part of a model or of a display name']],
    examples: [['guns', 'all of them'], ['guns rail', 'only models or names containing "rail"']],
    see: ['give', 'drop'],
  }),
});

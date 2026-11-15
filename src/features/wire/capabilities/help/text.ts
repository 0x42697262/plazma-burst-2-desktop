export const HELP_TEXT = Object.freeze({
  usage: 'wire help <message>',
  desc: "Show one message's fields, units and defaults",
  heading: (name: string, direction: string) => `${name}  (${direction})`,
  noteLine: (note: string) => `  note: ${note}`,
  field: (name: string, type: string, byDefault: string, desc: string) => `  ${name}  ${type}  ${byDefault}  ${desc}`,
  scaled: (scale: number) => `number x${scale}`,
  groupHeading: 'repeated per target:',
  about: ['The fields of one message, in send order: name, type (with its wire scale),',
    'the default when you leave it out, and what it is.'],
  see: ['wire', 'wire list'],
});

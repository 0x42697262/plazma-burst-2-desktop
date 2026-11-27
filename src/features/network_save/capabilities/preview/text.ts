export const TEXT = Object.freeze({
  usage: 'netsave preview [--raw]',
  desc: 'Exactly what the next upload would send: every value of the save, the login proof hidden',
  about: [
    'Builds the upload text with the game\'s own function, the way the next save would',
    'send it, and lists it value by value. --raw prints the text itself. The login proof',
    'is never shown; the password is never part of it.',
  ],
  examples: [['netsave preview', 'value by value'], ['netsave preview --raw', 'the text as sent']],
  usageError: 'usage: netsave preview [--raw]',
  title: (login: string, values: number, characters: number) => `The next upload to ${login} would send ${values} values, ${characters} characters:`,
});

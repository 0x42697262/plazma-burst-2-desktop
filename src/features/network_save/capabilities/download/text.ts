export const TEXT = Object.freeze({
  usage: 'netsave download [--raw]',
  desc: 'Asks the site for the account\'s network save now and shows it, without writing it anywhere',
  about: [
    'Sends the game\'s own download request (rq=load) for the page\'s account, through',
    'the desktop app, and lists what comes back value by value. Nothing is written: the',
    'local save stays as it is. --raw prints the text itself. The login proof is hidden.',
  ],
  examples: [['netsave download', 'value by value'], ['netsave download --raw', 'the text as the site sent it']],
  usageError: 'usage: netsave download [--raw]',
  asking: (login: string) => `Asking the site for ${login}'s network save...`,
  title: (login: string, values: number, characters: number) => `${login}'s network save: ${values} values, ${characters} characters. Nothing was written.`,
});

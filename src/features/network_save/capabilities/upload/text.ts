export const TEXT = Object.freeze({
  usage: 'netsave upload [--yes]',
  desc: 'Uploads the save to the account\'s network save now, with the game\'s own upload',
  about: [
    'Runs the game\'s own upload, with its rules: it goes to the page\'s account, it is',
    'skipped while a level is being played with no menu open, and the site\'s answer is not',
    'checked. Without --yes it only says what it would do. This overwrites the account\'s',
    'network save; compare the two sides first with the diff subcommand.',
  ],
  examples: [['netsave upload', 'what it would do'], ['netsave upload --yes', 'upload now']],
  usageError: 'usage: netsave upload [--yes]',
  wouldUpload: (login: string, values: number) => `This would overwrite ${login}'s network save with ${values} values from the local save, using the game's own upload.`,
  lobbyDiffers: (lobby: string, page: string) => `The lobby is logged in as ${lobby}; the upload goes to ${page}, the page's login.`,
  howToGo: 'Run "netsave upload --yes" to upload.',
  started: (login: string) => `Uploading to ${login}'s network save with the game's own upload...`,
  uploaded: (login: string) => `The game uploaded the save to ${login}'s network save (the game does not check the site's answer).`,
  skipped: 'The game did not upload: it skips while a level is being played with no menu open. Open the Esc menu and try again.',
  noRecord: 'The game\'s upload was started; the desktop app\'s record is not available to confirm it.',
});

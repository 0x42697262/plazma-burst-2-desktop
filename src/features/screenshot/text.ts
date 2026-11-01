export const TEXT = Object.freeze({
  noWindow: 'no game window',
  tooOften: 'one screenshot every 2 s',
  usage: 'screenshot [--console]',
  usageError: 'usage: screenshot [--console]',
  description: 'Save the game window as a PNG in screenshots/',
  about: [
    'Saves the game window as it looks now, with the "logic" and "trace" lines,',
    'to screenshots/pb2-<date>_<time>.png in the repository (not in git).',
    'The console is hidden for the shot unless you add --console.',
    'F12 takes one anywhere: in menus, in levels, with the console open. Change it',
    'with "screenshot_key".',
  ],
  args: [['--console', 'keep the console in the picture']],
  examples: [
    ['screenshot', 'the game, without the console'],
    ['screenshot_key f2', 'F2 takes one instead of F12 (anywhere, console open or not)'],
    ['screenshot_key off', 'no screenshot key'],
  ],
  notes: [
    'Desktop wrapper only: the wrapper captures the window and writes the file.',
    'The picture is the window\'s size in real pixels, so a bigger window is a bigger picture.',
  ],
  see: ['screenshot_key'],
  saved: (file: string) => `Saved ${file}`,
  failed: (message: string) => `could not save a screenshot (${message || 'desktop wrapper only'})`,
  errorLine: (text: string) => `error: ${text}`,
});

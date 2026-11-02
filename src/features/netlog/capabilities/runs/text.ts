export const RUNS_TEXT = Object.freeze({
  usage: 'netlog runs',
  description: 'Every network log in data/netlogs/: this window, other instances running now, earlier runs',
  about: [
    'One file per run and game instance: this window, remote play testers\' games,',
    'another copy of the app, earlier runs. "running" means written in the last 15 s.',
  ],
  examples: [['netlog runs', 'other instances and earlier runs']],
  see: ['netlog'],
  none: 'No network logs in data/netlogs/ yet.',
  title: (count: number) => `Network logs in data/netlogs/, newest first (${count}).`,
  owner: Object.freeze({ current: 'this window', mine: 'this app', active: 'other app, running', ended: 'ended' }),
  size: (kilobytes: string) => `${kilobytes} KB`,
  row: (index: string, name: string, owner: string, size: string, ago: string) => `  ${index}  ${name} ${owner} ${size}  updated ${ago}`,
  listFailed: 'error: could not list network logs (desktop wrapper only)',
  hint: '"netlog runs" = other instances',
});

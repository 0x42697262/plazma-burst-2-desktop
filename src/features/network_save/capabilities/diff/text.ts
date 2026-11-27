export const TEXT = Object.freeze({
  usage: 'netsave diff',
  desc: 'The local save next to the account\'s network save: what differs, and what only one side has',
  about: [
    'Downloads the network save (nothing is written) and compares it, value by value,',
    'with what the next upload would send. The login proof shows only as differing or not.',
  ],
  examples: [['netsave diff', 'local save vs network save']],
  usageError: 'usage: netsave diff',
  asking: (login: string) => `Comparing the local save with ${login}'s network save...`,
  summary: (same: number, changed: number, onlyLocal: number, onlyOnline: number) => `${same} the same, ${changed} differ, ${onlyLocal} only local, ${onlyOnline} only online`,
  changedTitle: 'Differ (local -> online):',
  changedRow: (name: string, local: string, online: string) => `  ${name}: ${local} -> ${online}`,
  onlyLocalTitle: 'Only in the local save:',
  onlyOnlineTitle: 'Only in the network save:',
});

export const TEXT = Object.freeze({
  minReputationUsage: 'usage: server min_reputation <n>',
  subcommand: { usage: 'server min_reputation <n>', desc: 'Lowest reputation that may stay ("-min_reputation"); players below it are removed' },
  ownerLine: (reputation: number) => `-min_reputation ${reputation}`,
});

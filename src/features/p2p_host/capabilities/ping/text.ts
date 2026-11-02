export const TEXT = Object.freeze({
  pingUsage: 'usage: server ping <ms | off>',
  subcommand: { usage: 'server ping <ms | off>', desc: 'Ping limit for players ("-ping"); 0 or off removes it' },
  ownerLine: (ms: number) => `-ping ${ms}`,
});

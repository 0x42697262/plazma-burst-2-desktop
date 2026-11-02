export const TEXT = Object.freeze({
  toPlayer: (name: string, text: string) => `To ${name}: ${text}`,
  tellUsage: 'usage: server tell <player> <text>',
  subcommand: { usage: 'server tell <player> <text>', desc: 'A server message only that player sees' },
});

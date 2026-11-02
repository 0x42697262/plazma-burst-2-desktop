export const TEXT = Object.freeze({
  ran: (text: string) => `ran: ${text}`,
  refusedSubject: (text: string) => `game ${text}`,
  sent: (text: string) => `sent to game: ${text} (output appears in game chat)`,
  textSeparator: ' ',
  usageError: 'usage: game <command>',
});

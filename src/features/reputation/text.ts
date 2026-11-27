export const DURATION = Object.freeze({
  daysHours: (days: number, hours: number) => `${days}d ${hours}h`,
  hoursMinutes: (hours: number, minutes: number) => `${hours}h ${minutes}m`,
  minutes: (minutes: number) => `${minutes}m`,
});

export const LOBBY_TEXT = Object.freeze({
  noAnswer: 'the lobby did not answer (log in to multiplayer first)',
  refused: (reason: string) => `the lobby refused: ${reason || 'no reason given'}`,
});


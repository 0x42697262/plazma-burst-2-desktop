export const TEXT = Object.freeze({
  unknownOption: (option: string, known: readonly string[]) =>
    `unknown option "${option}"${known.length ? `. Options: ${known.map((name) => `--${name}`).join(', ')}` : ''}. "-- ${option}" if it is a name.`,
  needsValues: (name: string, count: number) => `--${name} takes ${count === 1 ? 'a value' : `${count} values`}`,
  notTogether: (given: readonly string[]) => `${given.map((name) => `--${name}`).join(' and ')} do not go together`,
  timerError: (label: string, message: string) => `${label} error: ${message}`,
  on: 'on',
  off: 'off',
  now: 'now',
  secondsAgo: (seconds: string) => `${seconds}s ago`,
  minutesAgo: (minutes: number, seconds: number) => `${minutes}m ${seconds}s ago`,
  counted: (count: number, noun: string, suffix: string) => `${count} ${noun}${suffix}`,
});

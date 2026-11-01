export const TEXT = Object.freeze({
  logicTitle: 'logic: shown',
  logicRow: (description: string) => `  ${description || 'on'}`,
  varsTitle: (count: number) => `vars you changed: ${count}`,
  varsRow: (name: string, now: string, was: string) => `  ${name} ${now}  (was ${was})`,
});

export const TEXT = Object.freeze({
  listTitle: (count: number) => `binds: ${count}`,
  listRow: (key: string, command: string, profile: string | null) => `  ${key} ${command}${profile ? `  [profile ${profile} binds it here]` : ''}`,
  marked: (key: string, marks: readonly string[]) => (marks.length ? `${key} (${marks.join(', ')})` : key),
  holdMark: 'hold',
  passMark: 'pass',
  toggleMark: 'toggle',
});

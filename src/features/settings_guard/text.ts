export const TEXT = Object.freeze({
  bind: (key: string) => `bind ${key}`,
  profileBind: (profile: string, key: string) => `profile ${profile} bind ${key}`,
  profileOnload: (profile: string) => `profile ${profile} onload`,
  refused: 'Not saved: a command that runs code or acts as you was refused (settings_guard); the rest of your settings were saved. Type it again and answer Keep to save it.',
  dialogTitle: 'A command wants to be saved',
  dialogMessage: 'Something in the game page is saving a command that runs code or acts as you on a server. Your binds and profiles are shared by every game client.',
  dialogDetail: (lines: readonly string[]) => `${lines.join('\n')}\n\nKeep it only if you typed it yourself.`,
  dialogLine: (where: string, command: string) => `${where}: ${command}`,
  buttons: Object.freeze(['Refuse', 'Keep']),
  refusedLog: (count: number) => `settings_guard: refused saving ${count} risky command${count === 1 ? '' : 's'}`,
  keptLog: (count: number) => `settings_guard: you kept ${count} risky command${count === 1 ? '' : 's'}`,
});

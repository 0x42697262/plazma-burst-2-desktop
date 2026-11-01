export const GAME_COMMANDS: readonly (readonly [string, readonly (readonly [string, string])[]])[] = Object.freeze([
  ['Cheats', [
    ['god  /  god 1', 'Max HP x100000 and full heal'],
    ['god 0', 'Undo god (divides max HP by 100000)'],
    ['gm', 'Toggle a game-master flag (changes vehicle HP and health regen)'],
    ['hyper jump', 'Launch yourself upward'],
    ['headshot', 'Lose your head but keep your HP'],
    ['kill', 'Kill yourself'],
    ['kill enemies', 'Kill every character not on your team'],
  ]],
  ['Guns', [
    ['give <model>', 'Spawn a gun (upgrade 3) at your feet; picked up only if that slot is empty'],
    ['give all', 'Spawn 15 standard guns (upgrade 3) at your feet'],
  ]],
  ['Size and skins', [
    ['grow  /  shrink', 'Scale yourself x1.25 / /1.25 (HP and zoom follow)'],
    ['grow enemies  /  shrink enemies', 'Same for everyone else'],
    ['skin <n>  /  skin enemies <n>', 'Change your skin / everyone else\'s skin'],
    ['hero1skin <n>  /  hero2skin <n>', 'Set the skin used for hero 1 / hero 2'],
  ]],
  ['Game speed', [
    ['very slow | slower | slow', 'x0.25 | x0.5 | x0.75'],
    ['normal', 'x1'],
    ['fast | faster | very fast', 'x1.25 | x1.5 | x2'],
    ['extra fast | uber fast | over fast', 'x3 | x4 | x5'],
  ]],
  ['View', [
    ['zoom 25 | zoom 50 | zoom 100 | zoom 200', 'Camera zoom (only these four values; the console\'s "zoom" takes any)'],
    ['render 0  /  render 1', 'Hide / show the game world'],
    ['debug  /  debug 1  /  debug 0', 'Debug display on / on / off'],
  ]],
  ['Level', [
    ['quick start', 'Money 999999 and every campaign level unlocked'],
    ['no players | no barrels | no vehicles', 'Remove them from the level'],
    ['no lights  /  no lamps | no guns', 'Same for lights / map guns'],
    ['friends', 'Everyone on one team'],
    ['dm', 'Everyone on their own team (deathmatch)'],
    ['bot 1  /  bot 0', 'AI plays your character / you play again'],
  ]],
]);

export const TEXT = Object.freeze({
  helpTitle: 'Built-in game commands (run with: game <command>):',
  group: (group: string) => `[${group}]`,
  row: (command: string, description: string) => `  ${command} ${description}`,
  cheatNote: 'Cheat commands show an "achievements disabled" warning and save the game state.',
  clientOnlyWarning: 'WARNING: client-only. ',
  builtinState: (on: boolean) => `builtin is ${on ? 'on: commands run silently on any map, also in multiplayer' : 'off: commands appear in game chat; the game refuses them in multiplayer'} ("builtin on|off").`,
  gameLine: (line: string) => `  game: ${line}`,
  ran: (text: string) => `ran: ${text}`,
  usageError: 'usage: game <command>',
  refusedSubject: (text: string) => `game ${text}`,
  sent: (text: string) => `sent to game: ${text} (output appears in game chat)`,
  textSeparator: ' ',
  usage: 'game <command>',
  description: 'Run a built-in game chat command. "game help" lists them all',
  clientOnly: 'built-in commands run in your game only (with builtin off the game refuses them in multiplayer)',
  about: ['Runs one of the game\'s own chat commands. "game help" lists them all,', 'grouped, with what each one does.'],
  examples: [
    ['game help', 'every built-in command'],
    ['game god', 'the game\'s own god mode'],
    ['game kill enemies', 'kill everyone not on your team'],
  ],
  notes: [
    'With builtin on they run silently, on any map and in multiplayer. With',
    'builtin off they go through game chat, and the game refuses them in multiplayer.',
  ],
  see: ['builtin'],
});

export const BUILTIN_TEXT = Object.freeze({
  usage: 'builtin [on|off]',
  desc: 'Toggle silent built-in commands everywhere (see "get builtin")',
  about: Object.freeze(['A key, so "builtin" toggles it and "builtin on" / "builtin off" set it.']),
  see: Object.freeze(['game']),
});

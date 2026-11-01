export const GAME_COMMANDS_HELD: readonly (readonly [RegExp, 'hp' | 'aim'])[] = Object.freeze([
  [/^god(\s+1)?$/i, 'hp'],
  [/^grow$/i, 'hp'],
  [/^zoom\s+(25|50)$/i, 'aim'],
]);
export const NOTE_SEPARATOR = ', ';

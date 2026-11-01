export const HP_CHANGE = /^[+-]\d+(\.\d+)?%?$/;
export const HP_PERCENT_NO_SIGN = /^\d+(\.\d+)?%$/;
export const PERCENT_SIGN = '%';
export const PLUS = '+';
export const LEVEL_FAILED = 'failed';
export const ALL_WORD = 'all';
export const TO_WORD = 'to';
export const YOU = 'you';
export const TP_OPTION = Object.freeze({ on: 'on', off: 'off' });
export const TP_COMMAND = 'tp';
export const NO_CHARACTER_NAMED = /^no character named/;
export const CHARS_HINT = / Type "chars"\.$/;
export const WORD_SEPARATOR = ' ';
export const COMMAND = Object.freeze({
  heal: 'heal', hp: 'hp', revive: 'revive', reviveAliases: ['res'],
  tp: 'tp', tpAliases: ['teleport'], pos: 'pos', posAliases: ['where'], chars: 'chars', charsAliases: ['players', 'bots'],
});

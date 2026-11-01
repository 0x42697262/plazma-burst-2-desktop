import {
  BLANK_NUMBER, BLANK_STRING, BLOCK_COMMENT_END, BLOCK_COMMENT_START, ESCAPE, FIRST_DIGIT, LAST_DIGIT, LINE_COMMENT, LINE_END,
  NAME_CHARACTER, NUMBER_CHARACTER, QUOTES, WHITESPACE,
} from '../keys.ts';
import { ESCAPED_CHARACTER_STEP } from '../constants.ts';

const isDigit = (character: string): boolean => character >= FIRST_DIGIT && character <= LAST_DIGIT;

export function shapeOf(code: string): string {
  let shape = '';
  for (let index = 0; index < code.length; index++) {
    const character = code[index] ?? '';
    if (code.startsWith(LINE_COMMENT, index)) {
      const end = code.indexOf(LINE_END, index);
      index = end < 0 ? code.length : end - 1;
      continue;
    }
    if (code.startsWith(BLOCK_COMMENT_START, index)) {
      const end = code.indexOf(BLOCK_COMMENT_END, index + BLOCK_COMMENT_START.length);
      index = end < 0 ? code.length : end + 1;
      continue;
    }
    if (QUOTES.includes(character)) {
      let end = index + 1;
      while (end < code.length && code[end] !== character) end += code[end] === ESCAPE ? ESCAPED_CHARACTER_STEP : 1;
      shape += BLANK_STRING;
      index = end;
      continue;
    }
    const startsNumber = isDigit(character) && !NAME_CHARACTER.test(code[index - 1] ?? '');
    if (startsNumber) {
      let end = index;
      while (end < code.length && NUMBER_CHARACTER.test(code[end] ?? '')) end++;
      shape += BLANK_NUMBER;
      index = end - 1;
      continue;
    }
    if (!WHITESPACE.test(character)) shape += character;
  }
  return shape;
}

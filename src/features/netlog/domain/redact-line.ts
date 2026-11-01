import { ANSWER_SUFFIX, LOGGED_MESSAGE, ARGUMENT_QUOTE, ARGUMENT_ESCAPE, ARGUMENT_SEPARATOR, OPENING_BRACKETS, CLOSING_BRACKETS } from '../keys.ts';
import { LINE_TEXT } from '../text.ts';
import { SECRET_PARTS } from './redaction.ts';

function splitArguments(text: string): string[] {
  const args: string[] = [];
  let depth = 0;
  let isInString = false;
  let start = 0;
  for (let index = 0; index < text.length; index++) {
    const character = text[index] ?? '';
    if (isInString) {
      if (character === ARGUMENT_ESCAPE) index++;
      else if (character === ARGUMENT_QUOTE) isInString = false;
      continue;
    }
    if (character === ARGUMENT_QUOTE) isInString = true;
    else if (OPENING_BRACKETS.includes(character)) depth++;
    else if (CLOSING_BRACKETS.includes(character)) depth--;
    else if (depth === 0 && text.startsWith(ARGUMENT_SEPARATOR, index)) {
      args.push(text.slice(start, index));
      start = index + ARGUMENT_SEPARATOR.length;
      index += ARGUMENT_SEPARATOR.length - 1;
    }
  }
  if (text) args.push(text.slice(start));
  return args;
}

function asQuotedString(argument: string): string | null {
  if (!argument.startsWith(ARGUMENT_QUOTE) || !argument.endsWith(ARGUMENT_QUOTE)) return null;
  try {
    const parsed: unknown = JSON.parse(argument);
    return typeof parsed === 'string' ? parsed : null;
  } catch {
    return null;
  }
}

export function redactLoggedLine(line: string): string {
  const answerAt = line.indexOf(ANSWER_SUFFIX);
  const message = answerAt < 0 ? line : line.slice(0, answerAt);
  const tail = answerAt < 0 ? '' : line.slice(answerAt);
  const match = LOGGED_MESSAGE.exec(message);
  if (!match) return line;
  const [, head = '', name = '', argumentText = ''] = match;
  const rules = SECRET_PARTS[name];
  if (!rules) return line;
  const args = splitArguments(argumentText);
  const redacted = args.map((argument, index) => {
    const redactor = rules[index + 1];
    if (!redactor) return argument;
    const quoted = asQuotedString(argument);
    return quoted === null ? redactor(argument) : JSON.stringify(redactor(quoted));
  });
  return head + LINE_TEXT.message(name, redacted.join(LINE_TEXT.argumentSeparator)) + tail;
}

import { CHAIN_SEPARATOR, QUOTE } from './keys.ts';
import { CHAIN_JOIN } from '../state/keys.ts';

const nextSteps = new Map<string, number>();

const QUOTE_ESCAPED = '""';
const isPlain = (choice: string): boolean => !choice.includes(CHAIN_SEPARATOR) && !choice.includes(QUOTE);

export function joinToggleChoices(choices: readonly string[]): string {
  if (choices.every(isPlain)) return choices.join(CHAIN_JOIN);
  return choices.map((choice) => `${QUOTE}${choice.split(QUOTE).join(QUOTE_ESCAPED)}${QUOTE}`).join(' ');
}

function quotedChoices(command: string): string[] {
  const choices: string[] = [];
  let current = '';
  for (let index = 1; index < command.length; index++) {
    const character = command[index] ?? '';
    if (character !== QUOTE) {
      current += character;
      continue;
    }
    if (command[index + 1] === QUOTE) {
      current += QUOTE;
      index++;
      continue;
    }
    choices.push(current);
    current = '';
    index = command.indexOf(QUOTE, index + 1);
    if (index < 0) break;
  }
  return choices.map((choice) => choice.trim()).filter(Boolean);
}

export function toggleChoices(command: string): string[] {
  if (command.startsWith(QUOTE)) return quotedChoices(command);
  const choices: string[] = [];
  let current = '';
  let isQuoted = false;
  for (const character of command) {
    if (character === QUOTE) isQuoted = !isQuoted;
    if (character === CHAIN_SEPARATOR && !isQuoted) {
      choices.push(current);
      current = '';
      continue;
    }
    current += character;
  }
  choices.push(current);
  return choices.map((choice) => choice.trim()).filter(Boolean);
}

export function nextToggleCommand(key: string, command: string): string {
  const choices = toggleChoices(command);
  if (!choices.length) return command;
  const step = (nextSteps.get(key) ?? 0) % choices.length;
  nextSteps.set(key, step + 1);
  return choices[step] ?? command;
}

export const forgetToggleStep = (key: string): void => {
  nextSteps.delete(key);
};

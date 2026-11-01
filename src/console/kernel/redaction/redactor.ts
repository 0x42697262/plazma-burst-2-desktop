import { ESCAPED_MATCH, OBFUSCATED_PREFIX, REDACTION_PATTERN, exactNamesPattern, obfuscatedPattern } from './keys.ts';
import { HIDDEN } from './text.ts';
import { textOf } from '#kernel/text/text-of.ts';

export type Redactor = (text: unknown) => string;

const escapeForPattern = (text: string): string => text.replace(REDACTION_PATTERN.specialCharacters, ESCAPED_MATCH);
const isObfuscatedName = (value: unknown): value is string => typeof value === 'string' && value.startsWith(OBFUSCATED_PREFIX) && value.length > OBFUSCATED_PREFIX.length;

export function makeRedactor(names: Readonly<Record<string, unknown>> = {}): Redactor {
  const exactNames = Object.values(names).filter(isObfuscatedName).sort((first, second) => second.length - first.length);
  const exactPattern = exactNames.length ? exactNamesPattern(exactNames.map(escapeForPattern)) : null;
  const obfuscated = obfuscatedPattern();
  return (text) => {
    let redacted = textOf(text);
    if (exactPattern) redacted = redacted.replace(exactPattern, HIDDEN);
    return redacted
      .replace(REDACTION_PATTERN.escaped, HIDDEN)
      .replace(obfuscated, HIDDEN)
      .replace(REDACTION_PATTERN.path, HIDDEN)
      .replace(REDACTION_PATTERN.file, HIDDEN);
  };
}

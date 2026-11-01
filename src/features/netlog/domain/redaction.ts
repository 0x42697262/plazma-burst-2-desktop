import { MESSAGE_TYPE, PASSWORD_FIELD } from '../keys.ts';
import { REDACTED } from '../text.ts';

type PartRedactor = (part: string) => string;

const hideWhole: PartRedactor = (part) => (part === '' ? part : REDACTED);

const hideJsonField = (field: string): PartRedactor => (part) => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(part);
  } catch {
    return part;
  }
  const isObjectWithSecret = typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
    && typeof (parsed as Record<string, unknown>)[field] === 'string' && (parsed as Record<string, string>)[field] !== '';
  return isObjectWithSecret ? JSON.stringify({ ...(parsed as Record<string, unknown>), [field]: REDACTED }) : part;
};

export const SECRET_PARTS: Readonly<Record<string, Readonly<Record<number, PartRedactor>>>> = Object.freeze({
  [MESSAGE_TYPE.authenticate]: { 2: hideWhole },
  [MESSAGE_TYPE.joinMatch]: { 5: hideWhole },
  [MESSAGE_TYPE.createMatch]: { 1: hideJsonField(PASSWORD_FIELD) },
});

export function redactParts(typeName: string, parts: readonly string[]): string[] {
  const rules = SECRET_PARTS[typeName];
  if (!rules) return [...parts];
  return parts.map((part, index) => {
    const redactor = rules[index];
    return redactor ? redactor(part) : part;
  });
}

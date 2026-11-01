export const REDACTION_PATTERN = Object.freeze({
  path: /(?:\.{0,2}\/)?\b(?:data|desktop|docs|hooks|tools|test|game|game\.previous|scripts|screenshots|node_modules|src|dist|__dev|__hooks)\/(?:[^\s"'`)\],;]*[^\s"'`)\],;.:])?/g,
  file: /\b[\w.*-]+\.(?:md|js|mjs|cjs|json|ts)\b/g,
  escaped: /\$?(?:[0-9A-Za-z_$]|\\u[0-9a-fA-F]{4})*\\u04[0-9a-fA-F]{2}(?:[0-9A-Za-z_$]|\\u[0-9a-fA-F]{4})*/g,
  specialCharacters: /[.*+?^${}()|[\]\\]/g,
});
export const IDENTIFIER_CHARACTERS = '0-9A-Za-z_$\\u0400-\\u04FF';
export const CYRILLIC_CHARACTERS = '\\u0400-\\u04FF';
export const OBFUSCATED_PREFIX = '$';
export const ESCAPED_MATCH = '\\$&';
export const ALTERNATIVE = '|';
export const GLOBAL_FLAG = 'g';
export const obfuscatedPattern = (): RegExp => new RegExp(`\\$[${IDENTIFIER_CHARACTERS}]*[${CYRILLIC_CHARACTERS}][${IDENTIFIER_CHARACTERS}]*`, GLOBAL_FLAG);
export const exactNamesPattern = (escapedNames: readonly string[]): RegExp => new RegExp(`(?:${escapedNames.join(ALTERNATIVE)})(?![${IDENTIFIER_CHARACTERS}])`, GLOBAL_FLAG);

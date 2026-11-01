import { noComments } from './no-comments.ts';
import { noLiteralStrings } from './no-literal-strings.ts';

export const localRules = Object.freeze({
  rules: {
    'no-comments': noComments,
    'no-literal-strings': noLiteralStrings,
  },
});

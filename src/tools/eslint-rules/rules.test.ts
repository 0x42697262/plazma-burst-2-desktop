import { describe, it } from 'node:test';
import { RuleTester } from 'eslint';
import tseslint from 'typescript-eslint';
import { noComments } from './no-comments.ts';
import { noLiteralStrings } from './no-literal-strings.ts';

RuleTester.describe = describe;
RuleTester.it = it;
RuleTester.itOnly = it.only;

const tester = new RuleTester({ languageOptions: { parser: tseslint.parser, ecmaVersion: 'latest', sourceType: 'module' } });

tester.run('no-comments', noComments, {
  valid: [
    'const answer = 42;',
    '// eslint-disable-next-line no-console -- the CLI prints to the terminal\nconsole.log(1);',
    '// @ts-expect-error the game object has no types\nconst value = game.x;',
    '/// <reference types="node" />\nconst value = 1;',
    '/* SPDX-License-Identifier: MIT */\nconst value = 1;',
  ],
  invalid: [
    { code: '// explains the next line\nconst answer = 42;', errors: [{ messageId: 'comment' }] },
    { code: 'const answer = 42; /* inline */', errors: [{ messageId: 'comment' }] },
    { code: '// eslint-disable-next-line no-console\nconsole.log(1);', errors: [{ messageId: 'comment' }] },
    { code: '/**\n * docs\n */\nfunction run() {}', errors: [{ messageId: 'comment' }] },
  ],
});

tester.run('no-literal-strings', noLiteralStrings, {
  valid: [
    "import { join } from 'node:path';",
    "export { join } from 'node:path';",
    "const empty = '';",
    "const table = { key: 1 };",
    "if (typeof value === 'string') run();",
    "type Mode = 'local' | 'remote';",
    { code: "export const ROUTE = 'kv';", filename: '/repo/src/features/kv/keys.ts' },
    { code: "export const TEXT = { saved: `Saved ${'x'}` };", filename: '/repo/src/features/kv/text.ts' },
    { code: "assert.equal(run('help'), 'ok');", filename: '/repo/src/features/kv/kv.test.ts' },
    'const message = `${first}${second}`;',
  ],
  invalid: [
    { code: "const route = 'kv';", errors: [{ messageId: 'literal' }] },
    { code: 'const message = `saved ${name}`;', errors: [{ messageId: 'literal' }] },
    { code: "throw new Error('broken');", errors: [{ messageId: 'literal' }] },
    { code: "const table = { ['computed']: 1 };", errors: [{ messageId: 'literal' }] },
  ],
});

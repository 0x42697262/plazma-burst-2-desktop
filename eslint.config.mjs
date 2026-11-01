import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import { localRules } from './src/tools/eslint-rules/index.ts';

const MAGIC_NUMBERS_ALLOWED = [-1, 0, 1];

export default tseslint.config(
  { ignores: ['**/*', '!src/', '!src/**'] },
  ...[js.configs.recommended, ...tseslint.configs.recommendedTypeChecked].map((config) => ({ ...config, files: ['src/**/*.ts'] })),
  {
    files: ['src/**/*.ts'],
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    plugins: { local: localRules },
    rules: {
      'local/no-comments': 'error',
      'local/no-literal-strings': 'error',
      'id-length': ['error', { min: 2, exceptions: ['_'], properties: 'never' }],
      '@typescript-eslint/no-magic-numbers': ['error', {
        ignore: MAGIC_NUMBERS_ALLOWED, ignoreEnums: true, ignoreReadonlyClassProperties: true,
        ignoreTypeIndexes: true, ignoreArrayIndexes: true, ignoreDefaultValues: true,
      }],
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'prefer-const': 'error',
      eqeqeq: ['error', 'always'],
    },
  },
  {
    files: ['src/**/constants.ts', 'src/**/*.test.ts', 'src/**/*.fixture.ts'],
    rules: { '@typescript-eslint/no-magic-numbers': 'off' },
  },
  {
    files: ['src/**/*.test.ts', 'src/**/*.fixture.ts'],
    rules: {
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/require-await': 'off',
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);

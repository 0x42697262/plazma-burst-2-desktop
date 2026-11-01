export const ALLOWED_COMMENT_PATTERNS: readonly RegExp[] = Object.freeze([
  /^\s*eslint-(?:disable|enable)(?:-next-line|-line)?\s+\S.*\s--\s+\S/,
  /^\s*@ts-expect-error\s+\S/,
  /^\/\s*<reference\s/,
  /^\s*SPDX-License-Identifier:/,
  /^\*?\s*@license\b/,
]);

export const LITERAL_HOME_FILES: ReadonlySet<string> = new Set(['constants.ts', 'text.ts', 'events.ts', 'keys.ts', 'paths.ts']);
export const TEST_FILE_SUFFIXES: readonly string[] = Object.freeze(['.test.ts', '.fixture.ts']);
export const STRICT_DIRECTIVE = 'use strict';
export const TYPEOF_OPERATOR = 'typeof';
export const TS_NODE_PREFIX = 'TS';
export const MESSAGE_ID = Object.freeze({ comment: 'comment', literal: 'literal' });

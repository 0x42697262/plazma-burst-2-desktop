import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from '#kernel/config/paths.ts';
import { NAME_KEYS } from './keys.ts';

test('the console knows exactly the names find-names finds', () => {
  const source = fs.readFileSync(path.join(REPO_ROOT, 'tools', 'find-names.js'), 'utf8');
  const found = new Set<string>();
  for (const rule of source.matchAll(/keys:\s*\[([^\]]*)\]/g)) {
    for (const key of (rule[1] ?? '').matchAll(/'([^']+)'/g)) if (key[1] !== '_') found.add(key[1] ?? '');
  }
  assert.deepEqual([...NAME_KEYS].sort(), [...found].sort());
});

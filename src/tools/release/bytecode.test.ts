import { test } from 'node:test';
import assert from 'node:assert/strict';
import { compileToBytecode } from './bytecode.ts';
import { runBytecode } from '#wrapper/platform/bytecode.ts';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

const SOURCE = [
  "'use strict';",
  "const secretWord = 'cert-pinning-check';",
  'function pick(list, wanted) { for (const item of list) { if (item === wanted) return `found ${item}`; } return "missing"; }',
  'function later() { return pick([1, 2, 3], 3); }',
  'module.exports = { answer: pick(["a", secretWord], secretWord), later, source: String(later) };',
].join('\n');

test('the main process runs from V8 bytecode with no source: same results, functions called later too, and no source to read', () => {
  const bytecode = compileToBytecode(SOURCE, 'main.cjs');
  assert.ok(!bytecode.toString('latin1').includes('function pick'), 'the source text is not in it');
  const loaded: { exports: Record<string, unknown> } = { exports: {} };
  runBytecode(bytecode, 'main.cjs', { exports: loaded.exports, require, module: loaded, filename: 'main.cjs', dirname: '.' });
  assert.equal(loaded.exports.answer, 'found cert-pinning-check');
  assert.equal((loaded.exports.later as () => string)(), 'found 3', 'a function first called after loading still runs (compiled eagerly)');
  assert.doesNotMatch(String(loaded.exports.source), /for \(const item/, 'reading a function\'s source shows no code');
});

test('bytecode from another engine or a damaged file is refused, not run', () => {
  const bytecode = compileToBytecode(`${SOURCE}\nmodule.exports.other = 1;`, 'main.cjs');
  const damaged = Buffer.from(bytecode);
  damaged.writeUInt32LE(0, 4);
  const loaded: { exports: Record<string, unknown> } = { exports: {} };
  assert.throws(() => { runBytecode(damaged, 'main.cjs', { exports: loaded.exports, require, module: loaded, filename: 'main.cjs', dirname: '.' }); }, /bytecode/i);
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootConsole } from '#console/testing/fake-game.fixture.ts';
import { RISKY_COMMANDS, SAFE_COMMANDS } from './keys.ts';

test('every console command word is classified, so a new command cannot slip past the guard unnoticed', async () => {
  await bootConsole();
  const { runWords } = await import('#console/kernel/commands/registry.ts') as { runWords(): string[] };
  const classified = new Set([...RISKY_COMMANDS, ...SAFE_COMMANDS]);
  const unclassified = runWords().filter((word) => !classified.has(word));
  assert.deepEqual(unclassified, [], 'add each word to RISKY_COMMANDS or SAFE_COMMANDS in src/features/settings_guard/keys.ts');
  assert.deepEqual(RISKY_COMMANDS.filter((word) => SAFE_COMMANDS.includes(word)), [], 'a word is risky or safe, not both');
});

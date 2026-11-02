import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG_BY_ID } from '#shared/features/catalog.ts';
import { bootConsole } from '#console/testing/fake-game.fixture.ts';

test('in a feature split into capabilities, every command, subcommand and key names one of them', async () => {
  await bootConsole();
  const { CONSOLE_FEATURES } = await import('#console/features.ts');
  const { SCHEMA } = await import('#console/kernel/state/constants.ts');
  const missing: string[] = [];
  for (const feature of CONSOLE_FEATURES) {
    const declared = new Set(CATALOG_BY_ID.get(feature.id)?.capabilities.map((capability) => capability.id) ?? []);
    if (!declared.size) continue;
    for (const command of (feature.commands ?? []) as { name: string; capability?: string; subcommands?: { name: string; capability?: string }[] }[]) {
      if (!command.capability || !declared.has(command.capability)) missing.push(command.name);
      for (const subcommand of command.subcommands ?? []) {
        if (!subcommand.capability || !declared.has(subcommand.capability)) missing.push(`${command.name} ${subcommand.name}`);
      }
    }
    for (const override of feature.overrides ?? []) if (!override.capability || !declared.has(override.capability)) missing.push(override.name);
  }
  for (const [key, spec] of Object.entries(SCHEMA as Record<string, { feature: string; capability?: string }>)) {
    const declared = CATALOG_BY_ID.get(spec.feature as never)?.capabilities ?? [];
    if (declared.length && !declared.some((capability) => capability.id === spec.capability)) missing.push(`key ${key}`);
  }
  assert.deepEqual(missing, []);
});

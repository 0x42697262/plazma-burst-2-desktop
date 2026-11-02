import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import * as esbuild from 'esbuild';
import { CAPABILITIES, CATALOG } from '#shared/features/catalog.ts';
import { FEATURE } from '#shared/features/keys.ts';
import { withRequirements } from '#kernel/editions/resolve.ts';
import { bootConsole } from '#console/testing/fake-game.fixture.ts';
import { pageBuildOptions } from './build.ts';
import { oneOffEdition } from './edition-file.ts';

const SHORTEST_MARK = 12;

type Definition = { capability?: string; usage?: unknown; desc?: unknown; subcommands?: Definition[] };

async function marksOfEveryCapability(): Promise<Map<string, string[]>> {
  await bootConsole();
  const { CONSOLE_FEATURES } = await import('#console/features.ts');
  const { SCHEMA } = await import('#console/kernel/state/schema.ts');
  const marks = new Map<string, string[]>();
  const add = (capability: string | undefined, text: unknown) => {
    if (!capability || typeof text !== 'string' || text.length < SHORTEST_MARK) return;
    marks.set(capability, [...marks.get(capability) ?? [], text]);
  };
  const visit = (definition: Definition) => {
    add(definition.capability, definition.usage);
    add(definition.capability, definition.desc);
    for (const subcommand of definition.subcommands ?? []) visit(subcommand);
  };
  for (const feature of CONSOLE_FEATURES) for (const command of (feature.commands ?? []) as unknown as Definition[]) visit(command);
  for (const spec of Object.values(SCHEMA)) add(spec.capability, spec.desc);
  return marks;
}

test('a capability built alone carries no text or code of any other capability', async () => {
  const marks = await marksOfEveryCapability();
  const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb2-leaks-'));
  const leaks: string[] = [];
  try {
    for (const capability of CAPABILITIES) {
      const { edition } = oneOffEdition(withRequirements(CATALOG, [capability.id, FEATURE.devConsole]));
      const included = new Set(edition.capabilities ?? []);
      const result = await esbuild.build({ ...pageBuildOptions(outDir, edition), write: false });
      const bundle = result.outputFiles.map((file) => file.text).join('\n');
      for (const [other, texts] of marks) {
        if (included.has(other)) continue;
        const found = texts.find((text) => bundle.includes(text));
        if (found) leaks.push(`${capability.id} carries ${other}: ${found.slice(0, 60)}`);
      }
    }
  } finally {
    fs.rmSync(outDir, { recursive: true, force: true });
  }
  assert.deepEqual(leaks, []);
});

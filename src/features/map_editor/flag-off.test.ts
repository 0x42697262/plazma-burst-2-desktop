import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG } from '#shared/features/catalog.ts';
import { resolveFlags } from '#kernel/flags/resolve.ts';
import { bootConsole } from '../../../test/fake-game.mjs';

test('with the map_editor flag off (or triggers off) there is no editor command', async () => {
  const resolve = (id: string) => resolveFlags({ catalog: CATALOG, fileOverrides: {}, fileUnknownIds: [], envToggles: [{ id, on: false }], mode: 'local', client: 'official' }).states;
  assert.deepEqual(resolve('triggers').map_editor, { on: false, source: 'constraint', reason: 'needs triggers' });
  Object.defineProperty(globalThis, 'PB2_FEATURES', { value: Object.freeze(resolve('map_editor')) });
  const game = await bootConsole();
  assert.match(game.run('editor')[0] ?? '', /unknown command "editor"/);
});

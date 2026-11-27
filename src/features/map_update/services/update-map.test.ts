import { test } from 'node:test';
import assert from 'node:assert/strict';
import { matchesToReload, updateMap, type MatchLike, type UpdatePorts } from './update-map.ts';

function ports(answer: () => Promise<string>) {
  const calls: string[] = [];
  const made: UpdatePorts = {
    update: async (id) => { calls.push(`update ${id}`); return answer(); },
    reload: async (match) => { calls.push(`reload ${match.title}`); return match.title === 'broken' ? { ok: false, message: 'no' } : { ok: true, message: '' }; },
    tell: (match, text) => { calls.push(`tell ${match.title}: ${text}`); },
  };
  return { calls, made };
}
const match = (title: string, mapId: string): MatchLike => ({ title, map_id: mapId });

test('downloads first, then tells and reloads each match, and reports the ones that failed', async () => {
  const { calls, made } = ports(async () => '<player />');
  const report = await updateMap(made, 'm', [match('one', 'm'), match('broken', 'm')], 'updated, reloading');
  assert.deepEqual(calls, ['update m', 'tell one: updated, reloading', 'reload one', 'tell broken: updated, reloading', 'reload broken']);
  assert.deepEqual(report, { id: 'm', reloaded: ['one'], failed: [{ title: 'broken', message: 'no' }] });
});

test('a failed download reloads nothing', async () => {
  const { calls, made } = ports(async () => { throw new Error('not published'); });
  await assert.rejects(updateMap(made, 'm', [match('one', 'm')], 'x'), /not published/);
  assert.deepEqual(calls, ['update m']);
});

test('"now" with a map ID reloads every match playing it, whatever the case; a #match only that match', () => {
  const all = [match('a', 'Map-One'), match('b', 'other'), match('c', 'map-one')];
  assert.deepEqual(matchesToReload({ kind: 'map', id: 'map-one' }, true, all, () => { throw new Error('unused'); }).map((found) => found.title), ['a', 'c']);
  assert.deepEqual(matchesToReload({ kind: 'match', word: '2' }, true, all, (word) => all[Number(word) - 1] as MatchLike).map((found) => found.title), ['b']);
  assert.deepEqual(matchesToReload({ kind: 'map', id: 'map-one' }, false, all, () => all[0] as MatchLike), []);
});

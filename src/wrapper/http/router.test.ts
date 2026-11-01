import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDevRouter } from './router.ts';
import type { WrapperFeature } from '../feature-types.ts';

const respond = (text: string) => async () => new Response(text);
const features: WrapperFeature[] = [
  { id: 'screenshot', routes: [{ name: 'screenshot', handle: respond('shot') }] },
  { id: 'netlog', routes: [{ name: 'netlog', handle: respond('log') }, { name: 'netruns', handle: respond('runs') }] },
];

test('a route of a feature that is on answers; one that is off, or unknown, is left to the caller', async () => {
  const router = createDevRouter(features, (id) => id !== 'netlog');
  const url = new URL('https://example.test/__dev/screenshot');
  assert.equal(await (await router('screenshot', new Request(url), url, {}))?.text(), 'shot');
  assert.equal(await router('netlog', new Request(url), url, {}), null);
  assert.equal(await router('nope', new Request(url), url, {}), null);
});

test('two features serving one route is a wiring error', () => {
  const twice: WrapperFeature[] = [...features, { id: 'zoom', routes: [{ name: 'netlog', handle: respond('again') }] }];
  assert.throws(() => createDevRouter(twice, () => true), /two features serve the dev route "netlog"/);
});

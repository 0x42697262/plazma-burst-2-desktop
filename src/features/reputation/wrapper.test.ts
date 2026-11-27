import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSaveWatch } from './services/save-watch.ts';
import { networkSaveInterceptor } from './entry/network-save.ts';
import { deviceRoutes } from './entry/routes.ts';

const ID = 'abc12.def34.ghi56.jkl78';
const SITE = 'https://www.plazmaburst2.com/pb2/server.php';
const post = (url: string, fields: Record<string, string>) => new Request(url, { method: 'POST', body: new URLSearchParams(fields) });

function setup(on = true) {
  const watch = createSaveWatch();
  const fetched: string[] = [];
  const intercept = networkSaveInterceptor({ watch, hosts: ['www.plazmaburst2.com'], clock: () => 5000, isOn: () => on });
  const context = { fetch: async (request: Request) => { fetched.push(await request.clone().text()); return new Response(`volume=1;first_uid=${ID};first_login=player-one;first_login_proof=secret;`, { status: 200, headers: { 'Content-Type': 'text/html' } }); } };
  return { watch, fetched, intercept, context };
}

test('a network save download is passed through unchanged and its device id noted; the password is never kept', async () => {
  const { watch, fetched, intercept, context } = setup();
  const request = post(SITE, { rq: 'load', l: 'player-one', p: 'the-password' });
  const response = await intercept(request, new URL(SITE), context);
  assert.equal(fetched.length, 1);
  assert.equal(await response?.text(), `volume=1;first_uid=${ID};first_login=player-one;first_login_proof=secret;`);
  assert.equal(response?.headers.get('Content-Type'), 'text/html');
  assert.deepEqual(watch.snapshot(), { loads: [{ at: 5000, login: 'player-one', uid: ID, firstLogin: 'player-one', hasProof: true }], uploads: [] });
  assert.ok(!JSON.stringify(watch.snapshot()).includes('the-password') && !JSON.stringify(watch.snapshot()).includes('secret'));
});

test('an upload is noted from its body and goes on untouched', async () => {
  const { watch, fetched, intercept, context } = setup();
  const answer = await intercept(post(SITE, { rq: 'save', l: 'player-two', p: 'x', str: `first_uid=${ID};first_login=player-one;` }), new URL(SITE), context);
  assert.equal(answer, null, 'the game sends it itself');
  assert.equal(fetched.length, 0);
  assert.deepEqual(watch.snapshot().uploads, [{ at: 5000, login: 'player-two', uid: ID, firstLogin: 'player-one', hasProof: false }]);
});

test('maps, other hosts, other paths and the capability off are left alone', async () => {
  const { watch, intercept, context } = setup();
  assert.equal(await intercept(post(SITE, { rq: 'cmap', cmap: 'x' }), new URL(SITE), context), null);
  assert.equal(await intercept(post('https://evil.test/pb2/server.php', { rq: 'load', l: 'a' }), new URL('https://evil.test/pb2/server.php'), context), null);
  assert.equal(await intercept(post('https://www.plazmaburst2.com/other.php', { rq: 'load', l: 'a' }), new URL('https://www.plazmaburst2.com/other.php'), context), null);
  const off = setup(false);
  assert.equal(await off.intercept(post(SITE, { rq: 'load', l: 'a' }), new URL(SITE), off.context), null);
  assert.deepEqual(watch.snapshot(), { loads: [], uploads: [] });
});

test('the device route answers what was seen, never to a remote play tester, and keeps the last ones only', async () => {
  const { watch } = setup();
  for (let index = 0; index < 30; index++) watch.load({ at: index, login: 'a', uid: null, firstLogin: null, hasProof: false });
  const [route] = deviceRoutes({ watch });
  const answer = await route?.handle(new Request('https://x/__dev/device'), new URL('https://x/__dev/device'), {});
  const seen = await answer?.json() as { loads: { at: number }[] };
  assert.equal(seen.loads.length, 20);
  assert.equal(seen.loads.at(-1)?.at, 29);
  assert.equal((await route?.handle(new Request('https://x/__dev/device'), new URL('https://x/__dev/device'), { remote: true }))?.status, 403);
});

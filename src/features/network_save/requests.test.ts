import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSaveWatch } from './services/save-watch.ts';
import { requestRoutes } from './entry/requests.ts';

const SITE = 'https://www.plazmaburst2.com/pb2/server.php';
const ROUTE_URL = new URL('https://www.plazmaburst2.com/__dev/netsave');
const ID = 'abc12.def34.ghi56.jkl78';

function setup(allowed: string[] = ['load', 'save']) {
  const watch = createSaveWatch();
  const sent: { url: string; body: string }[] = [];
  const [route] = requestRoutes({ watch, hosts: ['www.plazmaburst2.com'], clock: () => 7000, isAllowed: (action) => allowed.includes(action) });
  const context = { fetch: async (request: Request) => { sent.push({ url: request.url, body: await request.text() }); return new Response(`first_uid=${ID};first_login=player-one;`); } };
  const ask = async (body: unknown, extra: Record<string, unknown> = {}) => {
    const response = await route?.handle(new Request(ROUTE_URL, { method: 'POST', body: JSON.stringify(body) }), ROUTE_URL, { ...context, ...extra });
    return { status: response?.status, body: response?.status === 200 ? await response.json() : await response?.text() };
  };
  return { watch, sent, ask };
}

test('a download the console asks for is the game\'s request, answered as text and noted as the console\'s', async () => {
  const { watch, sent, ask } = setup();
  const answer = await ask({ action: 'load', url: SITE, login: 'player-one', password: 'the-password' });
  assert.deepEqual(answer, { status: 200, body: { status: 200, text: `first_uid=${ID};first_login=player-one;` } });
  assert.deepEqual(sent, [{ url: SITE, body: 'rq=load&l=player-one&p=the-password' }]);
  assert.deepEqual(watch.snapshot().loads, [{ at: 7000, login: 'player-one', source: 'console', uid: ID, firstLogin: 'player-one', hasProof: false }]);
  assert.ok(!JSON.stringify(watch.snapshot()).includes('the-password'));
});

test('an upload sends the given text and notes its device id', async () => {
  const { watch, sent, ask } = setup();
  const answer = await ask({ action: 'save', url: SITE, login: 'player-one', password: 'pw', text: 'volume=1;first_uid=a.b.c.d;' });
  assert.equal(answer.status, 200);
  assert.equal(sent[0]?.body, 'rq=save&l=player-one&p=pw&str=volume%3D1%3Bfirst_uid%3Da.b.c.d%3B');
  assert.equal(watch.snapshot().uploads[0]?.uid, 'a.b.c.d');
});

test('refused: another address, no login, a capability off, a bad body, a remote tester', async () => {
  const { sent, ask } = setup(['load']);
  assert.equal((await ask({ action: 'load', url: 'https://evil.test/pb2/server.php', login: 'a', password: '' })).status, 400);
  assert.equal((await ask({ action: 'load', url: 'https://www.plazmaburst2.com/other.php', login: 'a', password: '' })).status, 400);
  assert.equal((await ask({ action: 'load', url: SITE, login: '', password: '' })).status, 400);
  assert.equal((await ask({ action: 'save', url: SITE, login: 'a', password: '', text: 'x=1;' })).status, 403);
  assert.equal((await ask({ action: 'delete', url: SITE, login: 'a', password: '' })).status, 400);
  assert.equal((await ask({ action: 'load', url: SITE, login: 'a', password: '' }, { remote: true })).status, 403);
  assert.equal(sent.length, 0, 'nothing reached the site');
});

import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { bootConsole } from '../../../test/support/fake-game.mjs';
import { NET_DIGITS, encNum, netMsg, netPacket, fakeConnection } from '#console/testing/net-protocol.fixture.ts';

const FP_SOURCE = `( v )=>{ try { let FP = class FP { static getBrowserFingerprint() {
  FP.hash1 = JSON.stringify({ canvas: 7, width: 1920 }); FP.hash2 = JSON.stringify({ canvas: 7, userAgent: 'UA', languages: ['en'] }); return 12345; } };
  let arr = []; arr.push( FP.getBrowserFingerprint( false, true ).toString( 36 ) ); arr.push( Intl.DateTimeFormat().resolvedOptions().timeZone );
  arr.push( 's27zkf' ); arr.push( '180.190.136.53' ); arr.push( location.origin ); arr.push( v ); arr.push( FP.hash1 ); arr.push( FP.hash2 );
  return arr.reverse().join( 'У' ); } catch(e){ return e.toString(); } }`;

type Game = Awaited<ReturnType<typeof bootConsole>>;
type Saved = { id: string; file: string; kind: string; chars: number; code: string; seen: number; versions: number; last: string };
let game: Game;
let capture: { tick(): void };
let recorder: { tick(time?: number): void; lines(): readonly string[] };

before(async () => {
  game = await bootConsole();
  ({ fingerprintCapture: capture } = await import('./console.ts'));
  ({ recorder } = await import('#features/netlog/console.ts'));
});

const settle = async () => { for (let round = 0; round < 5; round++) await new Promise((resolve) => setImmediate(resolve)); };
const printed = () => game.log.printed.filter((line) => !line.startsWith('> '));

test('the fingerprinter is sent to the wrapper once from the lobby connection, whatever net_log is; "fingerprint" runs the latest', async () => {
  const { G, N } = game;
  const network = G[N.net] as Record<string, unknown>;
  network[N.netDigits] = NET_DIGITS;
  network[N.netTypeNames] = { 5: 'RELIABLE_CHAT', 46: 'RELIABLE_TASK', 47: 'RELIABLE_TASK_ASNYC' };
  G[N.buildTag] = 'mkpnduz2';
  const hadLocation = 'location' in G;
  const realLocation: unknown = G.location;
  G.location = { origin: 'https://www.plazmaburst2.com' };
  const conn = fakeConnection(N);
  conn.socket.connected = true;
  const realFetch: unknown = G.fetch;
  const posts: [string, string][] = [];
  let saved: Saved | null = null;
  G.fetch = async (url: string, options?: { method?: string; body: string }) => {
    if (!url.includes('fingerprint')) return { ok: true, json: async () => ({}) };
    if (options?.method === 'POST') {
      posts.push([url, options.body]);
      saved = { id: 'a1b2c3d4e5f6', file: 'fingerprint/2026-11-01_05-30-12_a1b2c3d4e5f6.js', kind: 'sync', chars: options.body.length, code: options.body, seen: 1, versions: 1, last: new Date().toISOString() };
      return { ok: true, json: async () => ({ id: saved?.id, file: saved?.file, status: 'new' }) };
    }
    return saved ? { ok: true, status: 200, json: async () => saved } : { ok: false, status: 404, text: async () => 'no fingerprinter saved yet' };
  };
  let time = Date.now() + 500000;
  try {
    game.run('net_log off');
    recorder.tick(time);
    network[N.lobbyConn] = conn;
    network.connections = [conn];
    capture.tick();
    assert.ok(Object.hasOwn(conn, N.connRecv), 'listened to with net_log off');

    game.log.printed.length = 0;
    game.run('fingerprint');
    await settle();
    assert.match(game.log.printed.join('\n'), /No fingerprinter saved yet/);

    const task = (uid: number, code: string, callback: number) => netPacket(-1, '', [[uid, netMsg(46, code, encNum(callback))]]);
    conn[N.connRecv](task(0, FP_SOURCE, 110));
    conn[N.connRecv](task(0, FP_SOURCE, 110));
    conn[N.connRecv](task(1, '( v )=>v', 111));
    await settle();
    assert.deepEqual(posts, [['__dev/fingerprint?kind=sync', FP_SOURCE]]);
    assert.equal(conn.got.length, 3, 'the game gets every packet');
    assert.match(game.log.printed.join('\n'), /new fingerprinter \(version a1b2c3d4e5f6\): saved to fingerprint\//);

    game.run('net_log on');
    recorder.tick(time += 50);
    const since = recorder.lines().length;
    conn[N.connRecv](netPacket(0, '', [[2, netMsg(5, 'hi')]]));
    assert.equal(recorder.lines().slice(since).filter((line) => line.includes('CHAT("hi")')).length, 1);
    game.run('net_log off');
    recorder.tick(time += 50);
    assert.ok(Object.hasOwn(conn, N.connRecv), 'still listened to for the fingerprinter');

    game.log.printed.length = 0;
    game.run('fingerprint');
    await settle();
    const out = printed();
    assert.match(out[0] ?? '', /^Fingerprinter a1b2c3d4e5f6 \(fingerprint\/2026-11-01_05-30-12_a1b2c3d4e5f6\.js\): sync, \d+ chars, seen 1 time, last /);
    assert.match(out[1] ?? '', /^The game would answer with 1 part \(RESPONSE, callback ID, then these\): one text, 8 values joined by "У" \(U\+0423, this session's separator\):$/);
    assert.match(out[2] ?? '', /^ {2}\[0\] fingerprint, full \(3 values\)$/);
    assert.match(out[3] ?? '', /^ {8}canvas +7$/);
    assert.match(out[5] ?? '', /^ {8}languages +\["en"\]$/);
    assert.match(out[6] ?? '', /^ {2}\[1\] fingerprint, hardware only \(2 values\)$/);
    assert.match(out[9] ?? '', /^ {2}\[2\] build tag \(its argument v\) +mkpnduz2$/);
    assert.match(out[10] ?? '', /^ {2}\[3\] page origin +https:\/\/www\.plazmaburst2\.com$/);
    assert.match(out[11] ?? '', /^ {2}\[4\] IP address \(the server's view, in the source\) +180\.190\.136\.53$/);
    assert.match(out[12] ?? '', /^ {2}\[5\] token \(the server wrote it into the source\) +s27zkf$/);
    assert.match(out[13] ?? '', /^ {2}\[6\] time zone +/);
    assert.match(out[14] ?? '', /^ {2}\[7\] fingerprint hash \(MurmurHash3, base 36\) +9ix$/);
    game.log.printed.length = 0;
    game.run('fingerprint --raw');
    await settle();
    const raw = printed();
    assert.equal(raw.length, 3, raw.join('\n'));
    assert.match(raw[2] ?? '', /^ {2}\[0\] ".*У180\.190\.136\.53Уs27zkfУ.*У9ix"$/);

    network[N.lobbyConn] = null;
    capture.tick();
    assert.ok(!Object.hasOwn(conn, N.connRecv), 'the old connection is as it was');
  } finally {
    G.fetch = realFetch;
    if (hadLocation) G.location = realLocation; else delete G.location;
    delete network[N.lobbyConn];
    capture.tick();
    game.run('unset net_log');
    network.connections = [];
    recorder.tick(time + 50);
  }
});

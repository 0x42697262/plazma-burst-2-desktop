import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootConsole } from '#console/testing/fake-game.fixture.ts';

type Saved = { id: string; name?: string; address?: string; fingerprint?: string; nickname?: string; hasPassword: boolean };

test('console "servers": lists with ping, adds (fetching the fingerprint), keeps the password out of the history, connects', async () => {
  const game = await bootConsole();
  const saved: Saved[] = [];
  const calls: string[] = [];
  game.G.fetch = async (_url: string, options: { body: string }) => {
    const { op, arg } = JSON.parse(options.body) as { op: string; arg: Record<string, string> & string };
    calls.push(op);
    const answers: Record<string, () => unknown> = {
      list: () => ({ official: { id: 'official', name: 'PlazmaBurst2.com', host: 'vvvv.plazmaburst2.com', port: 2053, description: 'The official servers' }, servers: saved, last: null, gameVersion: 'v1', problems: [] }),
      check: () => (arg === 'official' ? { ping: 180 } : { ping: 4, status: { name: 'Paulbase', description: 'Friends', players: 2, max_players: 64, version: 'v1', password: true } }),
      fingerprint: () => 'AA:BB',
      save: () => {
        const server = { id: 'abc123', name: arg.name, address: arg.address, fingerprint: arg.fingerprint, nickname: arg.nickname, hasPassword: !!arg.password };
        saved.push(server);
        calls.push(JSON.stringify(arg));
        return { server };
      },
      play: () => true,
    };
    return { status: 200, json: async () => ({ ok: true, value: answers[op]?.() }) };
  };
  const settle = () => new Promise((resolve) => setTimeout(resolve, 20));
  const { history } = await import('#console/kernel/state/store.ts') as { history: { add(line: string): void; lines: string[] } };
  const { maskLine } = await import('#console/kernel/dispatch.ts') as { maskLine(line: string): string };
  const line = 'servers add address=192.168.1.20:2053 fingerprint=fetch nickname=Pal password=s3cret name="Pal base"';
  history.add(maskLine(line));
  game.log.printed.length = 0;
  game.G.pb2dev.run(line);
  await settle();
  const added = game.log.printed.slice();
  game.log.printed.length = 0;
  game.G.pb2dev.run('servers');
  await settle();
  const listed = game.log.printed.slice();
  game.log.printed.length = 0;
  game.G.pb2dev.run('servers connect pal');
  await settle();
  const connected = game.log.printed.slice();
  game.log.printed.length = 0;
  game.G.pb2dev.run('servers edit 1 nonsense=1');
  await settle();
  const errors = game.log.printed.filter((printed) => /^error/.test(printed));

  assert.deepEqual(history.lines.slice(-1), ['servers add address=192.168.1.20:2053 fingerprint=fetch nickname=Pal password=••• name="Pal base"']);
  assert.ok(added.every((printed) => !printed.includes('s3cret')), 'not in the log either');
  assert.ok(added.some((printed) => /fingerprint AA:BB/.test(printed)), 'fetched, with the warning to compare');
  assert.ok(added.some((printed) => /Saved Pal base \(192\.168\.1\.20:2053, as Pal, password saved\)/.test(printed)), added.join('\n'));
  assert.deepEqual(JSON.parse(calls.find((call) => call.startsWith('{')) ?? '{}'), { name: 'Pal base', address: '192.168.1.20:2053', fingerprint: 'AA:BB', nickname: 'Pal', password: 's3cret' }, 'the wrapper gets the real password');
  assert.ok(listed.some((printed) => /official\s+PlazmaBurst2\.com\s+vvvv\.plazmaburst2\.com:2053\s+180 ms/.test(printed)), listed.join('\n'));
  assert.ok(listed.some((printed) => /1\s+Paulbase\s+192\.168\.1\.20:2053\s+4 ms\s+2\/64/.test(printed)), listed.join('\n'));
  assert.ok(listed.some((printed) => /Friends · as Pal/.test(printed)));
  assert.ok(connected.some((printed) => /Connecting to Pal base/.test(printed)));
  assert.equal(calls.filter((call) => call === 'play').length, 1);
  assert.match(errors.join(' '), /unknown "nonsense="/);
});

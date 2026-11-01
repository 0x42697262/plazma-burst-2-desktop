import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { bootConsole, type FakeGame, type Lines } from '#console/testing/fake-game.fixture.ts';
import { errorsOf } from '#console/testing/console-output.fixture.ts';

let game: FakeGame;
before(async () => { game = await bootConsole(); });

test('profiles: a map\'s profile wins over your settings there, and is checked when the file is edited', async () => {
  const { profileWatcher } = await import('./console.ts');
  const profileTick = profileWatcher.tick;
  const atMap = (id: string | undefined) => { game.globals[game.names.mapId] = id; };
  const saved = () => JSON.parse(game.store.get('pb2dev_kv') ?? '');
  game.globals.stage.currentFrameLabel = 'gaming';
  game.frame();
  atMap(undefined);
  assert.match(game.run('profile')[0], /^No map loaded yet/);
  assert.match(errorsOf(game.run('profile use hard'))[0], /no map loaded yet/);

  atMap('c1a');
  game.run('god on; unset max_hp');
  assert.match(game.run('profile')[0], /^Map c1a: no profile, your settings apply/);
  assert.match(game.run('profile use hard')[0], /^Map c1a uses profile "hard" \(new\): nothing yet/);
  const quiet = (command: string): Lines => game.run(command).filter((line) => !line.startsWith('Note:')) as Lines;
  assert.deepEqual(quiet('profile set hard god off'), ['hard: god = off']);
  assert.deepEqual(quiet('get god'), ['god = off  [profile hard, yours: on]']);
  assert.ok(game.run('list player').some((line) => /^ {2}god\s+off\s.*\[profile hard, yours: on\]/.test(line)), 'list tags it');
  const on = game.run('god on').filter((line) => !line.startsWith('Note:'));
  assert.equal(on[0], 'god = on');
  assert.match(on[1] ?? '', /but profile "hard" sets god = off on this map, which wins \("profile unset hard god" to drop it\)/);

  game.run('profile set hard max_hp 500');
  game.frame();
  assert.equal(game.player.hmax, 500, 'max_hp from the profile');

  atMap('c2a');
  assert.deepEqual(quiet('get god'), ['god = on']);
  profileTick();
  atMap('c1a');
  game.log.printed.length = 0;
  profileTick();
  assert.deepEqual(game.log.printed, ['Map c1a uses profile "hard": god off, max_hp 500']);
  atMap('c2a');
  game.log.printed.length = 0;
  profileTick();
  assert.deepEqual(game.log.printed, ['Map c2a: no profile, your settings apply']);

  assert.deepEqual(game.run('profile use hard c3a'), ['Map c3a uses profile "hard": god off, max_hp 500']);
  const listed = game.run('profile list');
  assert.ok(listed.some((line) => /^ {2}hard\s+god off, max_hp 500\s+maps: c1a, c3a$/.test(line)), listed.join(' | '));
  assert.match(errorsOf(game.run('profile set hard page_size 20'))[0], /page_size is a console key/);
  assert.match(errorsOf(game.run('profile set none god on'))[0], /"none" means no profile/);
  assert.match(errorsOf(game.run('profile set hard speed 99'))[0], /speed must be between/);
  assert.deepEqual(saved().profiles, { hard: { god: false, max_hp: 500 } });
  assert.deepEqual(saved().maps, { c1a: 'hard', c3a: 'hard' });

  assert.deepEqual(game.run('profile unset hard max_hp'), ['hard: max_hp removed, your setting applies on its maps']);
  atMap('c3a');
  assert.match(game.run('profile use none')[0], /^Map c3a: no profile \(was "hard"\), your settings apply/);
  assert.match(game.run('profile delete hard')[0], /^Deleted profile "hard"; 1 map no longer use it: c1a/);
  assert.equal(saved().profiles, undefined);

  game.log.printed.length = 0;
  game.globals.pb2dev.reload({
    god: true,
    profiles: { fun: { speed: 99, page_size: 5, nokey: 1, jump: 2 }, 'bad name!': {}, odd: 5 },
    maps: { c2a: 'fun', c4a: 'ghost' },
  });
  assert.deepEqual(game.log.printed, [
    'dev-overrides.json changed: reloaded',
    'dev-overrides.json: profile "fun": speed 99: speed must be between 0.1 and 10; ignored',
    'dev-overrides.json: profile "fun": page_size is a console key, which a profile cannot set; ignored',
    'dev-overrides.json: profile "fun": unknown key "nokey", ignored',
    'dev-overrides.json: profile "bad name!": not a profile name (letters, digits, _ and -); ignored',
    'dev-overrides.json: profile "odd": must be an object of settings; ignored',
    'dev-overrides.json: map "c4a": no profile "ghost"; ignored',
  ]);
  atMap('c2a');
  assert.deepEqual(quiet('get jump'), ['jump = 2  [profile fun]']);
  assert.deepEqual(quiet('get god'), ['god = on']);
  game.globals.pb2dev.fileError('Unexpected token } in JSON at position 12');
  assert.match(game.log.printed.at(-1) ?? '', /cannot be read \(Unexpected token.*not saving changes to the file until it is fixed/);
  game.globals.pb2dev.reload({});
  atMap(undefined);
  game.run('unset god');
});

test('profile binds win over yours on its maps; onload runs as a level on them starts', async () => {
  const { profileWatcher } = await import('./console.ts');
  const profileTick = profileWatcher.tick;
  const atMap = (id: string | undefined) => { game.globals[game.names.mapId] = id; };
  const quiet = (command: string): Lines => game.run(command).filter((line) => !line.startsWith('Note:')) as Lines;
  const level = (on: boolean) => { game.globals.stage.currentFrameLabel = on ? 'gaming' : 'menu'; };
  game.run('unbind --all');
  game.globals.pb2dev.reload({});
  atMap('paul');
  profileTick();

  game.run('bind shift+j heal');
  quiet('profile use pb');
  const made = quiet('profile bind pb shift+j "vars set greet "hi"; vars get greet"');
  assert.equal(made[0], 'pb: shift+j = vars set greet "hi"; vars get greet');
  assert.match(made[1] ?? '', /on maps using "pb" \(paul\); it wins over your own shift\+j bind there/);
  let out = game.press('KeyJ', { shiftKey: true });
  assert.equal(out[0], '[profile pb bind shift+j] > vars set greet "hi"; vars get greet', out.join(' | '));
  assert.ok(out.includes('greet = "hi"'));
  assert.match(quiet('bind shift+j heal').join('\n'), /but profile "pb" binds shift\+j on this map, which wins there/);
  const listed = game.run('binds');
  assert.ok(listed.some((line) => /shift\+j\s+heal\s+\(not on this map: the profile's wins\)/.test(line)));
  assert.ok(listed.includes('On this map, profile "pb" binds (1):'));
  game.run('keyname');
  const named = game.press('KeyJ', { key: 'J', shiftKey: true });
  assert.ok(named.some((line) => /bound to \(profile pb, this map\): vars set greet/.test(line)), named.join(' | '));
  assert.ok(named.some((line) => /bound to \(yours, other maps\): heal/.test(line)));

  atMap('other');
  out = game.press('KeyJ', { shiftKey: true });
  assert.equal(out[0], '[bind shift+j] > heal', 'elsewhere, your bind');
  atMap('paul');

  assert.deepEqual(quiet('profile bind pb ; pos'), ['pb: semicolon = pos', '  on maps using "pb" (paul); it wins over your own semicolon bind there']);
  assert.match(errorsOf(game.run('profile bind pb k nonsense'))[0], /unknown command "nonsense"/);

  const chain = 'vars set loaded 1; vars get loaded';
  assert.deepEqual(quiet(`profile onload pb "${chain}"`), [`pb onload: ${chain}`, '  runs each time a level starts on a map using "pb"']);
  const ran = () => game.log.printed.filter((line) => line.startsWith('[profile pb onload]')).length;
  game.log.printed.length = 0;
  profileTick();
  assert.equal(ran(), 0, 'nothing starts while you are already in the level');
  level(false); profileTick();
  game.log.printed.length = 0;
  level(true); profileTick();
  assert.equal(game.log.printed[0], `[profile pb onload] > ${chain}`, game.log.printed.join(' | '));
  assert.ok(game.log.printed.includes('loaded = 1'));
  game.log.printed.length = 0;
  profileTick();
  assert.equal(ran(), 0, 'once per start');
  atMap('other');
  level(false); profileTick(); level(true); game.log.printed.length = 0; profileTick();
  assert.ok(!game.log.printed.some((line) => line.includes('onload')), 'not on other maps');

  const saved = JSON.parse(game.store.get('pb2dev_kv') ?? '');
  assert.deepEqual(saved.profiles.pb, { binds: { 'shift+j': 'vars set greet "hi"; vars get greet', semicolon: 'pos' }, onload: chain });
  game.log.printed.length = 0;
  game.globals.pb2dev.reload({ profiles: { q: { god: false, binds: { 'shift+k': 'heal', '?!': 'heal', x: 5 }, onload: ['heal', 'pos'] }, r: { onload: 7 } }, maps: { paul: 'q' } });
  assert.deepEqual(game.log.printed.slice(1), [
    'dev-overrides.json: profile "q": bind "?!": "?!" is not a key name. Examples: f, 5, f2, space, numpad1, shift+t. "keyname" shows a key\'s name; ignored',
    'dev-overrides.json: profile "q": bind "x": the command must be text; ignored',
    'dev-overrides.json: profile "r": "onload" must be commands as text (or a list of them); ignored',
  ]);
  atMap('paul');
  assert.equal(game.run('profile onload q')[0], 'q onload: heal; pos');
  assert.deepEqual(quiet('profile onload q --clear'), ['q: runs nothing on load now']);
  assert.match(quiet('profile unbind q shift+k')[0], /^q: unbound shift\+k \(was: heal\)/);
  game.globals.pb2dev.reload({});
  atMap(undefined);
  game.run('unbind --all');
});

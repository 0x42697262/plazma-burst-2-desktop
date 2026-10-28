// The dev console against a fake game (test/fake-game.mjs): "npm test".
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
import { bootConsole, CONSOLE_ENTRY } from './fake-game.mjs';

const consoleModule = (rel) => import(pathToFileURL(path.join(path.dirname(CONSOLE_ENTRY), rel)).href);
// An error from the console's own code, as opposed to a refusal it means to print.
const INTERNAL = /is not defined|is not a function|Cannot (read|set) propert|undefined is not/;
const errorsOf = (out) => out.filter((l) => l.startsWith('error: '));

let c;
before(async () => { c = await bootConsole(); });

test('every command and subcommand has help, and every "Related" topic exists', async () => {
  const { helpEntries } = await consoleModule('commands/registry.js');
  for (const { id, def } of helpEntries()) {
    assert.ok(def.usage && def.desc, `${id}: usage and desc`);
    assert.ok(def.help || def.renderHelp, `${id}: no help`);
    assert.deepEqual(errorsOf(c.run(`help ${id}`)), [], `help ${id}`);
    for (const see of def.help?.see || []) assert.deepEqual(errorsOf(c.run(`help ${see}`)), [], `${id} -> ${see}`);
  }
});

test('"<command> help" is "help <command>"', () => {
  for (const cmd of ['tp', 'triggers', 'vars', 'list', 'more']) assert.deepEqual(c.run(`${cmd} help`), c.run(`help ${cmd}`), cmd);
});

test('no command fails with an internal error', () => {
  const lines = [
    'help', 'list', 'list player', 'get speed', 'set speed 2', 'speed', 'speed default', 'god', 'god', 'reset',
    'hp 500', 'hp +10', 'hp -5%', 'unset max_hp', 'heal', 'revive', 'revive all', 'chars', 'pos', 'tp 1 2', 'tp 1',
    'guns', 'give rifle', 'drop', 'bind', 'bind f tp', 'binds', 'unbind f', 'triggers', 'triggers on', 'triggers 1',
    'triggers find god', 'triggers find type:225', 'triggers run #god', 'triggers history', 'vars', 'vars get door_1',
    'vars set x 5', 'vars sync door_1', 'vars sync x r', 'js 1+1', 'game help', 'builtin', 'maps', 'more', 'nonsense',
  ];
  for (const line of lines) {
    const out = c.run(line);
    assert.equal(out.filter((l) => INTERNAL.test(l)).length, 0, `${line}: ${out.join(' | ')}`);
  }
});

test('vars sync explains, sends with the chosen mode, and refuses a mode that cannot work', () => {
  const explain = c.run('vars sync door_1');
  assert.ok(explain.some((l) => l.includes('#resync') && l.includes('mode x (max)')), 'names the trigger that re-sends it');
  assert.ok(explain.some((l) => l.includes('#init') && l.includes('one call only')), 'names the seeder');
  assert.ok(explain.some((l) => l.startsWith('  Recommended: vars sync door_1 r')));

  c.log.net.length = 0;
  c.run('vars set var_mods "CTHC Lenaa honor23"; vars sync var_mods r');
  assert.deepEqual(c.log.net, [['VSYNC', 'r', 'var_mods', 'CTHC Lenaa honor23']]);

  c.log.net.length = 0;
  assert.match(errorsOf(c.run('vars sync var_mods x'))[0], /cannot deliver/);
  c.setMP(false);
  assert.match(errorsOf(c.run('vars sync var_mods r'))[0], /single-player/);
  c.setMP(true);
  assert.deepEqual(c.log.net, [], 'nothing sent when refused');
});

test('a ";" chain runs in order and stops at the first failure', () => {
  const out = c.run('vars set a 1; nonsense; vars set b 2');
  assert.ok(out.some((l) => l.startsWith('a = 1')));
  assert.ok(out.some((l) => l.startsWith('Stopped: 1 command after this one did not run.')));
  assert.equal(c.G[c.N.mapVars].b, undefined, 'the command after the failure did not run');
  assert.equal(c.run('vars set q "a;b"; vars get q').at(-1), 'q = "a;b"', 'a quoted ";" stays in the value');
  assert.deepEqual(c.run('js let n = 0; for (let i = 0; i < 3; i++) n += i; n'), ['3'], 'js is never split');
});

test('vars set types values like the map loader does', async () => {
  const { parseVarValue } = await consoleModule('triggers/vars.js');
  // The loader's rule, from scripts/frame2.js.
  const loader = (v) => (parseInt(v) + '' === v ? parseInt(v) : v);
  for (const v of ['5', '0', '-1', '-0', '01', '3.5', '1e3', '0x10', '', 'abc', '5abc', '+5', 'NaN', '99999999']) {
    assert.ok(Object.is(parseVarValue(v), loader(v)), v);
  }
  assert.equal(parseVarValue('"5"'), '5', 'quotes force text');
});

test('triggers run broadcasts a normal run, and keeps a forced one local', () => {
  c.log.net.length = 0;
  assert.ok(c.run('triggers run #open_door')[0].endsWith('sent to all players'));
  assert.deepEqual(c.log.net, [['EXEC', 'n0', '', '']]);

  c.log.net.length = 0;
  const locked = c.triggers.findIndex((t) => t.uid === '#locked');
  assert.match(errorsOf(c.run('triggers run #locked'))[0], /is disabled/);
  const out = c.run('triggers run #locked force');
  assert.ok(out.some((l) => l.startsWith('Note: ran in your game only')));
  assert.deepEqual(c.log.net, [], 'not sent');
  assert.equal(c.triggers[locked][c.N.trigEnabled], false, 'its enabled state is put back');
});

test('the run log records runs through the game\'s runner', () => {
  c.frame(2); // hooks the triggers
  c.run('triggers history clear');
  c.run('triggers run #open_door');
  c.run('triggers run #open_door');
  assert.ok(c.run('triggers history').some((l) => l.includes('#open_door') && l.includes('ran x2')));
});

test('settings are forced every frame and put back when removed', () => {
  const p = c.player;
  c.run('max_hp 500; jump 3; swords off');
  c.frame();
  assert.equal(p.hmax, 500);
  assert.equal(p[c.N.jump], 3);
  assert.equal(p[c.N.noSwords], true);
  c.run('god on');
  c.frame();
  p.hea = 1;
  assert.equal(p.hea, 500, 'god ignores damage');
  c.run('reset');
  c.frame();
  assert.equal(p.hmax, 130);
  assert.equal(p[c.N.jump], 1);
  assert.equal(p[c.N.noSwords], false);
});

test('a bind can only start with something that runs', () => {
  assert.deepEqual(errorsOf(c.run('bind f tp')), []);
  assert.deepEqual(errorsOf(c.run('bind f speed 2')), [], 'a key works too');
  assert.match(errorsOf(c.run('bind f chain'))[0], /unknown command "chain"/, 'a help-only topic does not');
  c.run('unbind all');
});

test('typed commands are saved with the settings', async () => {
  const { history } = await consoleModule('state/store.js');
  history.add('vars');
  history.add('vars'); // a repeat is kept once
  const saved = JSON.parse(c.store.get('pb2dev_kv'));
  assert.deepEqual(saved.history.slice(-1), ['vars']);
  assert.equal(saved.history.filter((l) => l === 'vars').length, 1);
});

test('leaving the level puts every forced value back', () => {
  const p = c.player;
  c.run('max_hp 400; jump 2; world_gravity 0.1');
  c.frame();
  assert.equal(p.hmax, 400);
  assert.equal(c.G.gravity, 0.1);
  c.G.stage.currentFrameLabel = 'menu';
  c.frame();
  assert.equal(p.hmax, 130, 'max HP back');
  assert.equal(p[c.N.jump], 1, 'jump back');
  assert.equal(c.G.gravity, 0.5, 'world gravity back');
  c.G.stage.currentFrameLabel = 'gaming';
  c.run('reset');
  c.frame();
});

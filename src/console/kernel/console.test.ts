import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import type { TestContext } from 'node:test';
import { bootConsole, type FakeGame } from '#console/testing/fake-game.fixture.ts';
import { errorsOf, errorOf } from '#console/testing/console-output.fixture.ts';

const INTERNAL = /is not defined|is not a function|Cannot (read|set) propert|undefined is not/;

let game: FakeGame;
before(async () => { game = await bootConsole({ sayTrigger: '#chat_in' }); });

test('every command and subcommand has help, and every "Related" topic exists', async () => {
  const { helpEntries } = await import('#console/kernel/commands/registry.ts');
  for (const { id, def } of helpEntries()) {
    assert.ok(def.usage && def.desc, `${id}: usage and desc`);
    assert.ok(def.help || def.renderHelp, `${id}: no help`);
    assert.deepEqual(errorsOf(game.run(`help ${id}`)), [], `help ${id}`);
    for (const see of def.help?.see || []) assert.deepEqual(errorsOf(game.run(`help ${see}`)), [], `${id} -> ${see}`);
  }
});

test('"<command> help" is "help <command>"', () => {
  for (const cmd of ['tp', 'triggers', 'vars', 'list', 'more']) assert.deepEqual(game.run(`${cmd} help`), game.run(`help ${cmd}`), cmd);
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
    const out = game.run(line);
    assert.equal(out.filter((line) => INTERNAL.test(line)).length, 0, `${line}: ${out.join(' | ')}`);
  }
});

test('a ";" chain runs in order and stops at the first failure', () => {
  const out = game.run('vars set a 1; nonsense; vars set b 2');
  assert.ok(out.some((line) => line.startsWith('a = 1')));
  assert.ok(out.some((line) => line.startsWith('Stopped: 1 command after this one did not run.')));
  assert.equal(game.globals[game.names.mapVars].b, undefined, 'the command after the failure did not run');
  assert.equal(game.run('vars set q "a;b"; vars get q').at(-1), 'q = "a;b"', 'a quoted ";" stays in the value');
  assert.deepEqual(game.run('js let n = 0; for (let i = 0; i < 3; i++) n += i; n'), ['3'], 'js is never split');
});

test('settings are forced every frame and put back when removed', () => {
  const character = game.player;
  game.run('max_hp 500; jump 3; swords off');
  game.frame();
  assert.equal(character.hmax, 500);
  assert.equal(character[game.names.jump], 3);
  assert.equal(character[game.names.noSwords], true);
  game.run('god on');
  game.frame();
  character.hea = 1;
  assert.equal(character.hea, 500, 'god ignores damage');
  game.run('reset');
  game.frame();
  assert.equal(character.hmax, 130);
  assert.equal(character[game.names.jump], 1);
  assert.equal(character[game.names.noSwords], false);
});

test('typed commands are saved with the settings', async () => {
  const { history } = await import('#console/kernel/state/store.ts');
  history.add('vars');
  history.add('vars');
  const saved = JSON.parse(game.store.get('pb2dev_kv') ?? '');
  assert.deepEqual(saved.history.slice(-1), ['vars']);
  assert.equal(saved.history.filter((line: string) => line === 'vars').length, 1);
});

test('leaving the level puts every forced value back', () => {
  const character = game.player;
  game.run('max_hp 400; jump 2; world_gravity 0.1');
  game.frame();
  assert.equal(character.hmax, 400);
  assert.equal(game.globals.gravity, 0.1);
  game.globals.stage.currentFrameLabel = 'menu';
  game.frame();
  assert.equal(character.hmax, 130, 'max HP back');
  assert.equal(character[game.names.jump], 1, 'jump back');
  assert.equal(game.globals.gravity, 0.5, 'world gravity back');
  game.globals.stage.currentFrameLabel = 'gaming';
  game.run('reset');
  game.frame();
});

test('list shows binds, traces, the logic view and the vars you changed after the keys', () => {
  game.run('unbind --all; trace --off; logic hide; vars del a; vars del q; vars del x; vars set var_mods "CTHC Lenaa"');
  const quiet = game.run('list');
  for (const extra of ['binds', 'trace', 'logic', 'vars']) {
    assert.ok(!quiet.some((line) => line.startsWith(`[${extra}`)), `${extra} only shows when something is set`);
  }
  const before = game.run('vars get door_1').find((line) => line.startsWith('door_1 = '))?.slice('door_1 = '.length);
  game.run('bind f tp; trace 1; logic show type:trigger; vars set door_1 7; vars set fresh "hi"; vars set fresh "yo"');
  const out = game.run('list');
  const at = (title: string) => out.findIndex((line) => line.startsWith(`[${title}`));
  assert.ok(at('player') < at('binds'), 'after the keys');
  assert.match(out[at('binds') + 1] ?? '', /^ {2}f\s+tp$/);
  assert.match(out[at('trace') + 1] ?? '', /#1 bob\s+\d+px/);
  assert.match(out[at('logic') + 1] ?? '', /in the whole map/);
  assert.equal(out[at('vars')], '[vars you changed: 2]');
  assert.ok(out.includes(`  ${'door_1'.padEnd(14)} 7  (was ${before})`), out.join('\n'));
  assert.ok(out.some((line) => /fresh\s+"yo"\s+\(was \(not set\)\)/.test(line)), 'the value before the first change');
  assert.deepEqual(game.run('list binds'), ['[binds: 1]', `  ${'f'.padEnd(14)} tp`]);
  game.run(`vars set door_1 ${before}; vars del fresh`);
  assert.deepEqual(game.run('list vars'), ['[vars] nothing']);
  game.run('unbind --all; trace --off; logic hide');
});

test('a ";" where a key name goes is the ";" key; everywhere else it ends a command', () => {
  game.run('unbind --all');
  assert.deepEqual(game.run('bind ; "heal; pos"'), ['semicolon = heal; pos']);
  assert.deepEqual(game.run('bind shift+; heal'), ['shift+semicolon = heal']);
  const pressed = game.press('Semicolon');
  assert.ok(pressed.includes('[1/2] heal') && pressed.includes('[2/2] pos'), pressed.join(' | '));
  assert.deepEqual(game.run('bind ;'), ['semicolon = heal; pos']);
  const split = game.run('bind ;; pos');
  assert.equal(split[0], '[1/2] bind ;');
  assert.equal(split[2], '[2/2] pos');
  assert.ok(game.run('bind f heal; pos').includes('[2/2] pos'), 'unquoted, the bind ends at ";"');
  assert.deepEqual(game.run('unbind ;'), ['Unbound semicolon (was: heal; pos)']);
  assert.deepEqual(game.run('screenshot_key ;'), ['screenshot_key = semicolon']);
  assert.deepEqual(game.run('set screenshot_key shift+;'), ['screenshot_key = shift+semicolon']);
  assert.equal(game.run('set speed 2; speed')[0], '[1/2] set speed 2', 'not a key setting: splits');
  game.run('unset screenshot_key; unset speed; unbind --all');
});


const REFUSED = /^error: refused in a ranked match: .*"bypass checks" turns this protection off \(dangerous\)\.$/;
const inMatch = (context: TestContext, details: Record<string, unknown>) => {
  const net = game.globals[game.names.net];
  net.match_details = details;
  context.after(() => { delete net.match_details; });
};
const RANKED = Object.freeze({ approved: 2, ranked: true, map_id: 'zynther-alaska' });

test('only in an approved, ranked match: raising HP and zooming out are refused; the rest still works', (context) => {
  const character = game.player;
  context.after(() => { game.run('reset'); game.run('zoom default'); game.frame(); });
  game.frame();
  const own = character.hmax;
  for (const details of [{ approved: 2, ranked: false }, { approved: 0, ranked: false }, null]) {
    game.globals[game.names.net].match_details = details;
    assert.ok(game.run('max_hp 500').includes('max_hp = 500'), JSON.stringify(details));
    game.run('unset max_hp');
  }
  inMatch(context, RANKED);
  for (const line of ['max_hp 500', 'hp +100', 'hp +50%', 'hp_bonus 20', 'hp_bonus_pct 10', 'zoom 50', 'zoom 30 --lock', 'game god', 'game god 1', 'game grow', 'game zoom 25']) {
    assert.match(errorOf(game.run(line)), REFUSED, line);
  }
  assert.match(errorOf(game.run('max_hp 500')), /HealthAltering.*docs\/research\/anticheat\.md §14\.4/);
  assert.match(errorOf(game.run('zoom 50')), /announces to the other players.*§14\.6/);
  assert.equal(character.hmax, own, 'nothing changed');
  assert.ok(game.run(`max_hp ${own - 30}`).includes(`max_hp = ${own - 30}`));
  assert.ok(game.run('zoom 150').some((line) => line.startsWith('Zoom 150%')));
  assert.doesNotMatch(game.run('game grow enemies').join(' '), /refused/);
  assert.ok(game.run('speed 2').includes('speed = 2'));
});

test('settings you had are not applied in a ranked match, even with god on, and come back in an unranked one', (context) => {
  const character = game.player;
  inMatch(context, { approved: 2, ranked: false });
  context.after(() => { game.run('reset'); game.run('zoom --unlock'); game.frame(); });
  game.frame();
  const own = character.hmax;
  game.run('max_hp 470; god on; zoom 40 --lock');
  game.frame();
  assert.equal(character.hmax, 470);
  assert.equal(character.hea, 470);
  assert.equal(game.globals[game.names.zoom], 0.4);
  game.log.printed.length = 0;
  game.globals[game.names.net].match_details = { ...RANKED };
  game.frame();
  assert.equal(character.hmax, own, 'max HP back to the game\'s');
  assert.equal(character.hea, own, 'HP down to it, past god');
  assert.equal(game.globals[game.names.zoom], 1, 'zoom back to 100%');
  const notes = game.log.printed.join('\n');
  assert.match(notes, /Ranked match: not applying max_hp: .*HealthAltering.*Your saved values are kept/);
  assert.match(notes, /Ranked match: not applying your zoom 40%/);
  game.log.printed.length = 0;
  game.frame(3);
  assert.deepEqual(game.log.printed, [], 'said once');
  character.hea = 1;
  assert.equal(character.hea, own, 'god itself still works');
  game.globals[game.names.net].match_details = { approved: 2, ranked: false };
  game.frame();
  assert.equal(character.hmax, 470, 'unranked again: applied again');
  assert.equal(game.globals[game.names.zoom], 0.4);
});


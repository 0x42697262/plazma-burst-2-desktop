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
before(async () => { c = await bootConsole({ sayTrigger: '#chat_in' }); });

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

test('triggers find by: finds what runs a trigger', () => {
  // The rows of a "by:" search: [uid, what runs it].
  const found = (q) => c.run(`triggers find ${q}`).slice(1).map((l) => l.trim().split(/\s+/)[1]);
  const row = (q, uid) => c.run(`triggers find ${q}`).find((l) => l.includes(` ${uid} `)) || '';
  assert.deepEqual(found('by:region'), ['#open_door']);
  assert.match(row('by:region', '#open_door'), /by region #0 #button at 10, 20 \(use key\)/);
  assert.deepEqual(found('by:timer'), ['#open_door', '#resync']);
  // Index and uid differ: timer #0 is the one the map calls #Clock*7.
  assert.deepEqual(found('by:timer#0'), ['#resync']);
  assert.deepEqual(found('by:#Clock*7'), ['#resync']);
  assert.deepEqual(found('by:#clock*7'), ['#resync'], 'uids ignore case');
  assert.match(row('by:timer#0', '#resync'), /by timer #0 #Clock\*7/);
  assert.deepEqual(found('by:chat'), ['#chat_in']);
  assert.deepEqual(found('by:death'), ['#on_death']);
  assert.deepEqual(found('by:player#1'), ['#on_death']);
  assert.deepEqual(found('by:start'), ['#boot']);
  // A 363 jump counts: #chat_in continues in #kick.
  assert.match(row('by:trigger uid:kick', '#kick'), /by trigger #\d+ #chat_in \(continues in it\)/);
  assert.ok(found('by:none').includes('#god'), 'nothing in the map starts #god');
  assert.ok(!found('by:none').includes('#god_all'), '#god continues in #god_all');
  assert.deepEqual(found('by:#chat_in'), ['#kick']);
});

test('triggers find by: combines with the other terms', () => {
  const out = c.run('triggers find by:timer a:door_1');
  assert.ok(out.some((l) => l.includes('#open_door') && l.includes('action 1')), 'actions inside timer-run triggers');
  assert.ok(!out.some((l) => l.includes(' trigger ')), 'no trigger rows once actions are asked for');
  assert.match(errorsOf(c.run('triggers find by:bogus'))[0], /by: expects one of/);
  assert.match(errorsOf(c.run('triggers find by:chat#2'))[0], /takes no number/);
  assert.match(c.run('triggers find by:#nothing')[0], /No trigger or action matches/);
});

test('logic: a tree of what reaches an element and what it acts on', () => {
  const out = c.run('logic #kick');
  const i = out.indexOf('Reached from:');
  assert.match(out[i + 1], /<- #chat_in\s+trigger #\d+\s+action 1: 363 continue in trigger A/);
  assert.match(out[i + 2], /<- chat message/, 'the chat trigger is followed back to chat');
  const door = c.run('logic #door_a');
  assert.ok(door.some((l) => /<- #open_door .*action 2: 0/.test(l)), 'the action on the door');
  assert.ok(door.some((l) => /<- #sign\s+decor #0\s+attach/.test(l)), 'what is attached to it');
  assert.ok(c.run('logic #two words').some((l) => /<- #open_door .*action 3: 99 run trigger A/.test(l)), 'a uid with a space');
  assert.match(errorsOf(c.run('logic #nope'))[0], /nothing in this map is called "#nope"/);
});

test('logic show draws every link where the camera puts it', async () => {
  const view = await consoleModule('logic/view.js');
  const cam = c.G.game;
  const lineStarts = () => c.log.drawn.filter((d) => d[0] === 'moveTo').map((d) => [d[1], d[2]].join(','));
  cam.x = 100; cam.y = 50; cam.scaleX = cam.scaleY = 1;
  c.run('logic show');
  c.log.drawn.length = 0;
  const all = view.drawFrame();
  assert.ok(all.lines > 5, `${all.lines} lines`);
  // Region #button (10, 20) runs #open_door: world + camera, in game units.
  assert.ok(lineStarts().includes('110,70'), 'region at world 10,20 is drawn at 110,70');
  assert.ok(c.log.drawn.some((d) => d[0] === 'setTransform' && d[1] === 2), 'two canvas pixels per game unit');
  assert.ok(c.log.drawn.some((d) => d[0] === 'fillText' && d[1] === '#button'), 'labelled with its uid');

  cam.scaleX = cam.scaleY = 0.5; // zoom 50
  c.log.drawn.length = 0;
  view.drawFrame();
  assert.ok(lineStarts().includes('105,60'), 'zoom scales the world, not the screen offset');

  c.run('logic show start');
  const starts = view.drawFrame();
  assert.ok(starts.lines > 0 && starts.lines < all.lines, 'a kind filter draws fewer');
  c.run('logic show #door_a');
  assert.equal(view.drawFrame().lines, 2, 'around one element: its two links');

  cam.x = 1e6; // the camera far away: nothing on screen is drawn
  assert.equal(view.drawFrame().lines, 0);
  cam.x = 100; cam.scaleX = cam.scaleY = 1;
  c.run('logic hide');
  assert.equal(c.log.frames.length, 0, 'no frame left pending');
});

test('a bind holds a ";" chain, and pressing the key runs all of it', () => {
  assert.deepEqual(errorsOf(c.run('bind shift+t "revive; god"')), [], 'a one-word first command');
  const out = c.press('KeyT', { shiftKey: true });
  assert.equal(out[0], '[bind shift+t] > revive; god');
  assert.ok(out.includes('[1/2] revive') && out.includes('[2/2] god'), out.join(' | '));
  assert.match(errorsOf(c.run('bind g "revive; nonsense"'))[0], /unknown command "nonsense"\./, 'every command is checked');
  assert.match(errorsOf(c.run('bind g "revive; nonsense 5"'))[0], /unknown command "nonsense" in "nonsense 5"/);
  assert.deepEqual(errorsOf(c.run('bind h fast load maps on')), [], 'a phrase is checked as its key');
  c.run('unbind all; unset god');
});

test('logic filters by element type', async () => {
  const view = await consoleModule('logic/view.js');
  assert.match(c.run('logic')[1], /Types: trigger \d+, .*player 2/, 'lists the map\'s types');
  const count = (q) => Number(c.run(`logic show ${q}`)[0].match(/^Showing (\d+) link/)[1]);
  const all = count('');
  const noPlayers = count('not:player');
  assert.ok(noPlayers < all, 'not: drops links touching players');
  assert.equal(count('not:players'), noPlayers, 'plurals work');
  assert.equal(count('type:region,trigger'), count('type:regions,triggers'));
  assert.ok(count('type:region,trigger start') <= count('type:region,trigger'), 'combines with a kind');
  assert.equal(count('#door_a type:decor'), 1, 'around an element, type: picks its neighbours');
  assert.match(errorsOf(c.run('logic show type:nonsense'))[0], /this map has no "nonsense"\. Types: /);
  c.run('logic show not:player');
  c.log.drawn.length = 0;
  view.drawFrame();
  assert.ok(!c.log.drawn.some((d) => d[0] === 'fillText' && /^#player/.test(d[1])), 'no player is drawn');
  c.run('logic hide');

  const tree = c.run('logic #god_all not:player');
  assert.ok(!tree.some((l) => l.includes('#player')), 'the tree drops player rows');
  assert.ok(c.run('logic #door_a type:region').some((l) => l.includes('nothing that passes the filters')));
});

test('logic screen keeps only what the camera shows, as it moves', async () => {
  const view = await consoleModule('logic/view.js');
  const cam = c.G.game;
  const labels = () => { c.log.drawn.length = 0; view.drawFrame(); return c.log.drawn.filter((d) => d[0] === 'fillText').map((d) => d[1]); };
  const lineStarts = () => c.log.drawn.filter((d) => d[0] === 'moveTo').map((d) => `${d[1]},${d[2]}`);
  // The view covers world x -100..700, y -50..350: #god_all (40, -300) is off screen,
  // the players it acts on are on it.
  cam.x = 100; cam.y = 50; cam.scaleX = cam.scaleY = 1;
  // #god_all is at world (40, -300): screen (140, -250), above the top edge.
  c.run('logic show');
  labels();
  assert.ok(lineStarts().includes('140,-250'), 'without "screen", a link running off the edge is drawn');
  c.run('logic show screen');
  labels();
  assert.ok(!lineStarts().includes('140,-250'), 'with it, only links with both ends on screen');
  assert.ok(labels().includes('#button'), 'what is on screen still is');
  cam.y = 400; // the camera moves up: #god and #god_all come on screen (y 100), #button leaves (y 420)
  assert.ok(labels().includes('#god_all'), 'it follows the camera');
  assert.ok(!labels().includes('#button'), 'and drops what left it');
  cam.y = 50;
  assert.match(c.run('logic show visible')[0], /both ends on screen .*\d+ links? right now/);
  c.run('logic hide');

  assert.ok(c.run('logic #god_all screen').some((l) => /-> #player\*0/.test(l)), 'the tree keeps rows on screen');
  cam.x = 1e6;
  assert.ok(!c.run('logic #god_all screen').some((l) => l.includes('-> #player')), 'and drops the rest');
  cam.x = 100;
});

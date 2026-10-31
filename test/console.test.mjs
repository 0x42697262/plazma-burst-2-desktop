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
  assert.match(c.run('logic')[1], /Types: trigger \d+, .*player \d+/, 'lists the map\'s types');
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

test('logic labels never overlap: grouped, collapsed, opened by the crosshair', async () => {
  const { layoutLabels } = await consoleModule('ui/labels.js');
  const bounds = { w: 800, h: 400 };
  const hit = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const overlapping = (ls) => ls.some((a, i) => ls.some((b, j) => j > i && hit(a, b)));
  const at = (x, y, ...texts) => texts.map((text) => ({ x, y, text }));

  // Elements at the same spot share one label, one uid per line.
  let { labels } = layoutLabels(at(100, 100, '#a', '#b', '#c'), { bounds });
  assert.equal(labels.length, 1);
  assert.deepEqual(labels[0].lines, ['#a', '#b', '#c']);

  // A big group shows two and "+N more" until the crosshair is on it.
  const five = at(100, 100, '#a', '#b', '#c', '#d', '#e');
  assert.deepEqual(layoutLabels(five, { bounds }).labels[0].lines, ['#a', '#b', '+3 more']);
  ({ labels } = layoutLabels([...five, ...at(300, 300, '#far')], { cursor: { x: 103, y: 98 }, bounds }));
  assert.deepEqual(labels.at(-1).lines, ['#a', '#b', '#c', '#d', '#e'], 'open, and drawn last (on top)');
  assert.equal(labels.at(-1).open, true);

  // A crowded screen: no two drawn labels overlap.
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const crowd = Array.from({ length: 150 }, (_, i) => ({ x: 300 + rnd() * 200, y: 150 + rnd() * 100, text: `#element*${i}` }));
  const r = layoutLabels(crowd, { bounds });
  assert.equal(overlapping(r.labels), false);

  // Far too many for the screen: the extras are hidden, still none overlap, and the one
  // under the crosshair is always shown.
  const jam = Array.from({ length: 400 }, (_, i) => ({ x: 380 + (i % 20) * 2, y: 190 + Math.floor(i / 20) * 1, text: `#jam*${i}` }));
  const j = layoutLabels(jam, { cursor: { x: 420, y: 205 }, bounds });
  assert.ok(j.hidden > 0, `${j.hidden} hidden`);
  assert.equal(overlapping(j.labels.filter((l) => !l.open)), false);
  assert.ok(j.labels.some((l) => l.open), 'the group under the crosshair is drawn');
});

test('regions run fires a region as if its condition were met', () => {
  const list = c.run('regions');
  assert.ok(list.some((l) => /#\d+\s+#button\s+use key\s+-> trigger #\d+ #open_door/.test(l)));
  assert.ok(list.some((l) => /#clock_switch\s+use key\s+-> timer #1 #timer\*2/.test(l)), 'a timer region names its timer');
  assert.ok(list.some((l) => /#spawn_spot\s+never/.test(l)));

  // Use key, as you: runs its trigger, and sends what the game sends, with the region.
  c.log.net.length = 0;
  const runsBefore = c.log.runs.length;
  const out = c.run('regions run #button');
  assert.match(out.at(-1), /^Ran region #0 #button: trigger #\d+ #open_door .*sent to all players/);
  assert.equal(c.log.runs.length, runsBefore + 1, 'the trigger ran through the game\'s runner');
  assert.deepEqual(c.log.net, [['EXEC', `n${c.triggers.findIndex((t) => t.uid === '#open_door')}`, 'n0', '']]);
  assert.equal(c.G[c.N.triggerActivator], -1, 'the activator is put back');

  // The mode is checked as the game would: a red-team use key refuses team 0.
  assert.match(errorsOf(c.run('regions run #red_use'))[0], /would not fire for #0: it is for team 12; #0 is on team 0\./);
  c.log.net.length = 0;
  const forced = c.run('regions run #red_use force');
  assert.ok(forced.some((l) => l.includes('forced past its condition')));
  assert.ok(forced.some((l) => l.startsWith('Note: ran in your game only') && l.includes('region\'s own condition')));
  assert.deepEqual(c.log.net, [], 'forced past the mode: not sent');

  // A use key only fires for yourself; a bot is refused.
  assert.match(errorsOf(c.run('regions run #button as 2'))[0], /only your own use key fires it/);

  // A timer region starts its timer instead of running a trigger, and is not sent.
  const timer = c.G[c.N.timers][1];
  timer[c.N.trigEnabled] = false;
  c.log.net.length = 0;
  const t = c.run('regions run #clock_switch');
  assert.match(t[0], /^Fired region #2 #clock_switch: started timer #1 #timer\*2/);
  assert.equal(timer[c.N.trigEnabled], true);
  assert.deepEqual(c.log.net, []);
  assert.ok(!c.run('triggers find by:region').some((l) => l.includes('#clock_switch')), 'a timer region starts no trigger');

  assert.match(errorsOf(c.run('regions run #spawn_spot'))[0], /runs nothing/);
  assert.match(errorsOf(c.run('regions run #nope'))[0], /no region "#nope"/);
});

test('triggers find calls: and maxcalls: compare calls', () => {
  const found = (q) => c.run(`triggers find ${q}`).slice(1).map((l) => l.trim().split(/\s+/)[1]);
  const byUid = (uid) => c.triggers.find((t) => t.uid === uid);
  const boot = byUid('#boot'), init = byUid('#init');
  boot[c.N.trigCalls] = 1; init[c.N.trigCalls] = 0; // #boot not run yet, #init used up
  assert.deepEqual(found('maxcalls:1').sort(), ['#boot', '#init'], 'one-shots');
  assert.deepEqual(found('calls:0'), ['#init'], 'used up');
  assert.deepEqual(found('maxcalls:1 calls:1'), ['#boot'], 'one-shots not run yet');
  assert.deepEqual(found('calls:<1'), ['#init']);
  assert.deepEqual(found('calls:>=1 maxcalls:<=1'), ['#boot']);
  const unlimited = c.triggers.filter((t) => t[c.N.trigMaxCalls] === -1).length;
  assert.equal(found('calls:unlimited').length, unlimited);
  assert.equal(found('calls:>5').length, unlimited, 'unlimited counts as more than any number');
  assert.equal(found('calls:!=0').length, c.triggers.length - 1);
  assert.match(c.run('triggers find calls:0')[0], /^1 trigger matches "calls:0"/, 'not "by uid"');
  assert.deepEqual(found('calls:0 uid:boot'), [], 'combines with the other terms');
  assert.match(errorsOf(c.run('triggers find calls:lots'))[0], /calls: expects a number or "unlimited"/);
  boot[c.N.trigCalls] = 1; init[c.N.trigCalls] = 1;
});

test('trace draws a white line from you to each traced character', async () => {
  const overlay = await consoleModule('ui/overlay.js');
  const cam = c.G.game;
  cam.x = 100; cam.y = 50; cam.scaleX = cam.scaleY = 1;
  // You at (0, 0), bob (#1) at (100, -50), bluebot (#2) at (600, 100). Set here: earlier
  // tests teleport you around.
  const place = [[0, 0], [100, -50], [600, 100]];
  place.forEach(([x, y], i) => { c.chars[i].x = x; c.chars[i].y = y; });
  const frame = () => { c.log.drawn.length = 0; return overlay.drawOverlay(); };
  const texts = () => c.log.drawn.filter((d) => d[0] === 'fillText').map((d) => d[1]);

  assert.match(c.run('trace')[0], /Not tracing anyone/);
  assert.match(c.run('trace 1')[0], /^Tracing slot #1 bob \(112px\)/);
  assert.equal(frame().trace.lines, 1);
  // Middles are 41 above the feet: you (0, -41) -> screen (100, 9); bob -> (200, -41).
  assert.ok(c.log.drawn.some((d) => d[0] === 'moveTo' && d[1] === 100 && d[2] === 9), 'from your middle');
  assert.ok(c.log.drawn.some((d) => d[0] === 'lineTo' && d[1] === 200 && d[2] === -41), 'to bob\'s middle');
  assert.ok(texts().includes('#1 bob 112px'), 'name and distance');

  c.run('trace --all');
  assert.equal(frame().trace.lines, 2, 'everyone but you');
  c.run('trace --off 2');
  frame();
  assert.deepEqual(texts(), ['#1 bob 112px'], 'from "all", the others stay');
  assert.match(errorsOf(c.run('trace 0'))[0], /that is you/);
  assert.match(errorsOf(c.run('trace nobody'))[0], /no character named "nobody"/);

  // Off screen: bluebot far right, its label where the line leaves the screen.
  c.run('trace 2');
  const bot = c.chars[2];
  bot.x = 5000;
  frame();
  const plate = c.log.drawn.filter((d) => d[0] === 'fillRect').map((d) => ({ x: d[1], w: d[3] }));
  assert.ok(plate.every((r) => r.x >= 0 && r.x + r.w <= 800), 'every label inside the screen');
  assert.ok(texts().some((t) => t.startsWith('#2 bluebot 5001px')), 'distance from (0, 0) to (5000, 100)');
  bot.x = 600;

  bot.hea = 0;
  frame();
  assert.ok(texts().some((t) => t.endsWith('(down)')), 'a downed character is marked');
  bot.hea = 100;

  c.run('logic show');
  const both = frame();
  assert.ok(both.logic && both.trace, 'logic and traces in one frame');
  c.run('logic hide');
  assert.ok(frame().trace, 'hiding logic keeps the traces');
  c.run('trace --off');
  assert.equal(c.log.frames.length, 0, 'the overlay goes with its last layer');
});

test('list shows binds, traces, the logic view and the vars you changed after the keys', () => {
  // Earlier tests changed these; undoing a change takes it off the list.
  c.run('unbind --all; trace --off; logic hide; vars del a; vars del q; vars del x; vars set var_mods "CTHC Lenaa"');
  const quiet = c.run('list');
  for (const extra of ['binds', 'trace', 'logic', 'vars']) {
    assert.ok(!quiet.some((l) => l.startsWith(`[${extra}`)), `${extra} only shows when something is set`);
  }
  const before = c.run('vars get door_1').find((l) => l.startsWith('door_1 = ')).slice('door_1 = '.length);
  c.run('bind f tp; trace 1; logic show type:trigger; vars set door_1 7; vars set fresh "hi"; vars set fresh "yo"');
  const out = c.run('list');
  const at = (title) => out.findIndex((l) => l.startsWith(`[${title}`));
  assert.ok(at('player') < at('binds'), 'after the keys');
  assert.match(out[at('binds') + 1], /^ {2}f\s+tp$/);
  assert.match(out[at('trace') + 1], /#1 bob\s+\d+px/);
  assert.match(out[at('logic') + 1], /in the whole map/);
  assert.equal(out[at('vars')], '[vars you changed: 2]');
  assert.ok(out.includes(`  ${'door_1'.padEnd(14)} 7  (was ${before})`), out.join('\n'));
  assert.ok(out.some((l) => /fresh\s+"yo"\s+\(was \(not set\)\)/.test(l)), 'the value before the first change');
  assert.deepEqual(c.run('list binds'), ['[binds: 1]', `  ${'f'.padEnd(14)} tp`]);
  // Back to where it started: no longer a change.
  c.run(`vars set door_1 ${before}; vars del fresh`);
  assert.deepEqual(c.run('list vars'), ['[vars] nothing']);
  c.run('unbind --all; trace --off; logic hide');
});

test('trace --players skips bots, and a word that is not an option is a name', () => {
  const traced = () => c.run('trace').slice(1).map((l) => l.trim().split(/\s+/).slice(0, 2).join(' '));
  c.run('trace --off');
  assert.match(c.run('trace --players')[0], /^Tracing every other player: 1 character now/);
  assert.deepEqual(traced(), ['#1 bob'], 'bluebot is a bot');
  c.chars[2][c.N.charHuman] = true; // a player in that slot now
  assert.deepEqual(traced(), ['#1 bob', '#2 bluebot'], 'who joins later is traced too');
  c.chars[2][c.N.charHuman] = false;
  c.run('trace --players bluebot');
  assert.deepEqual(traced(), ['#1 bob', '#2 bluebot'], 'a bot on top of the players');
  c.run('trace --off 1');
  assert.deepEqual(traced(), ['#2 bluebot'], 'one left out, the group stays');
  assert.match(c.run('trace')[0], /\(every other player, also who joins later\)/);
  c.run('trace --off');

  // Old keywords are names now; a miss says what was meant.
  assert.match(errorsOf(c.run('trace all'))[0], /no character named "all"\. For the option, type "trace --all"/);
  assert.match(errorsOf(c.run('tp off'))[0], /no character named "off"\. For the old hotkey syntax, type "tp --off"/);
  const bob = c.chars[1];
  bob.nickname = 'all';
  assert.match(c.run('trace all')[0], /^Tracing #1 all/, 'a player named "all"');
  c.run('trace --off');
  bob.nickname = '--odd--';
  assert.match(errorsOf(c.run('trace --odd--'))[0], /unknown option "--odd--"\. Options: --all, --players, --npc, --team, --enemies, --off\. "-- --odd--" if it is a name/);
  assert.match(c.run('trace -- --odd--')[0], /^Tracing #1 --odd--/);
  c.run('trace --off');
  bob.nickname = '1 2';
  assert.match(c.run('tp -- 1 2').at(-1), /^Teleported to #1 1 2 at/, 'after "--" two numbers are a name');
  bob.nickname = 'bob';
  for (const help of ['trace --help', 'tp -h', 'revive --help']) {
    assert.deepEqual(c.run(help), c.run(`help ${help.split(' ')[0]}`), help);
  }
});

test('trace filters: a kind and a side combine, and what cannot go together says so', () => {
  // You and bob (#1, a player) are team 0; bluebot (#2, an NPC) is team 13.
  const traced = () => c.run('trace').slice(1).map((l) => l.trim().split(/\s+/).slice(0, 2).join(' '));
  const bot = c.chars[2];
  c.run('trace --off');
  assert.match(c.run('trace --enemies')[0], /^Tracing everyone on the other teams: 1 character now/);
  assert.deepEqual(traced(), ['#2 bluebot']);
  c.run('trace --team');
  assert.deepEqual(traced(), ['#1 bob'], 'a new group replaces the old one');
  assert.deepEqual(c.run('trace --all --team'), c.run('trace --team'), '--all with a filter changes nothing');
  c.run('trace --npc');
  assert.deepEqual(traced(), ['#2 bluebot']);
  assert.match(c.run('trace --players --enemies')[0], /^Tracing every other player on the other teams: 0 characters now/);
  assert.match(c.run('trace')[0], /^Tracing every other player on the other teams, but nobody is here yet/);
  assert.ok(c.run('list trace').includes('[trace: 0 (--players --enemies)]'));
  c.run('trace --npc --team');
  assert.deepEqual(traced(), [], 'bluebot is not on your team');
  bot.team = 0;
  assert.deepEqual(traced(), ['#2 bluebot'], 'teams are checked as they are now');
  bot.team = 13;
  c.run('trace --npc --team 1');
  assert.deepEqual(traced(), ['#1 bob'], 'a name on top of a group that has nobody');

  for (const [line, err] of [
    ['trace --players --npc', /--players and --npc do not go together/],
    ['trace --team --enemies', /--team and --enemies do not go together/],
    ['trace --off --enemies', /--off and --enemies do not go together/],
    ['trace --off --all', /--off and --all do not go together/],
    ['trace --enemy', /unknown option "--enemy"/],
  ]) {
    const before = traced();
    assert.match(errorsOf(c.run(line))[0] || '', err, line);
    assert.deepEqual(traced(), before, `${line} changes nothing`);
  }
  assert.match(errorsOf(c.run('trace enemies'))[0], /For the option, type "trace --enemies"/);
  c.run('trace --off');
});

test('trace by name follows the player until they leave; by # follows the slot', async () => {
  const traced = () => c.run('trace').slice(1).map((l) => l.trim().split(/\s+/).slice(0, 2).join(' '));
  const bob = c.chars[1];
  // A player leaves: the game switches the slot off. Another joins: the same character,
  // with their account and nickname.
  const leave = (ch) => { ch.io = false; };
  const join = (ch, login, nick) => { Object.assign(ch, { io: true, login, nickname: nick }); };
  const settle = () => new Promise((r) => queueMicrotask(r));
  c.run('trace --off');
  join(bob, 'bob_account', 'bob');

  c.run('trace bob');
  assert.deepEqual(traced(), ['#1 bob']);
  leave(bob);
  assert.deepEqual(traced(), [], 'bob left');
  await settle();
  assert.equal(c.log.frames.length, 0, 'nothing left to draw: the overlay goes');
  join(bob, 'eve_account', 'eve');
  assert.deepEqual(traced(), [], 'eve in bob\'s slot is not bob');
  join(bob, 'bob_account', 'bob');
  assert.deepEqual(traced(), [], 'leaving ended it, even when bob comes back');

  c.run('trace 1');
  join(bob, 'eve_account', 'eve');
  assert.deepEqual(traced(), ['#1 eve'], 'a slot, whoever is in it');
  assert.ok(c.run('trace').some((l) => /#1 eve\s+\d+px\s+slot: whoever is in it/.test(l)));
  leave(bob);
  assert.deepEqual(traced(), []);
  join(bob, 'bob_account', 'bob');
  assert.deepEqual(traced(), ['#1 bob'], 'the slot stays traced while it is empty');
  c.run('trace --off');

  // Dropped from a group the same way: by name the person, by # the slot.
  c.run('trace --all; trace --off bob');
  assert.deepEqual(traced(), ['#2 bluebot']);
  join(bob, 'eve_account', 'eve');
  assert.deepEqual(traced(), ['#1 eve', '#2 bluebot'], 'eve was never dropped');
  c.run('trace --off 1');
  join(bob, 'bob_account', 'bob');
  assert.deepEqual(traced(), ['#2 bluebot'], 'the slot stays dropped');
  c.run('trace --off');
  delete bob.login;
});

test('screenshot hides the console, asks the wrapper, and has a hotkey (F12) you can change', async () => {
  const { game } = await consoleModule('game/bindings.js');
  const panel = () => game.overlay().childNodes.find((n) => n.style.zIndex === '50');
  const calls = [];
  let reply = { ok: true, json: async () => ({ file: 'screenshots/pb2-x.png' }) };
  const realFetch = c.G.fetch;
  c.G.fetch = async (url, opt) => { calls.push([url, opt && opt.method]); return reply; };
  const settle = () => new Promise((r) => setTimeout(r, 0));
  // Frames run when the test says so: the capture waits for two without the console.
  const shoot = async (start) => {
    start();
    for (let n = 0; n < 3; n++) { c.log.frames.splice(0).forEach((f) => f()); await settle(); }
  };
  try {
    c.run('trace --off; logic hide');
    let hiddenAtCapture;
    c.G.fetch = async (url, opt) => { hiddenAtCapture = panel().style.visibility; calls.push([url, opt && opt.method]); return reply; };
    await shoot(() => c.run('screenshot'));
    assert.deepEqual(calls, [['__dev/screenshot', 'POST']]);
    assert.equal(hiddenAtCapture, 'hidden', 'no console in the picture');
    assert.equal(panel().style.visibility, 'visible', 'and back after');
    assert.ok(c.log.printed.includes('Saved screenshots/pb2-x.png'));
    assert.ok(game.overlay().childNodes.some((n) => n.textContent !== undefined && n.style.right === '10px'), 'a notice in the corner');

    await shoot(() => c.run('screenshot --console'));
    assert.equal(hiddenAtCapture, 'visible', '--console keeps it');

    calls.length = 0;
    await shoot(() => c.press('F12'));
    assert.equal(calls.length, 1, 'F12 by default, console closed');
    assert.match(c.run('screenshot_key f2')[0], /^screenshot_key = f2$/);
    await shoot(() => c.press('F12'));
    assert.equal(calls.length, 1, 'F12 is free now');
    await shoot(() => c.press('F2'));
    assert.equal(calls.length, 2);
    assert.match(c.run('bind f2 heal').join('\n'), /f2 is the screenshot key, which wins/);
    c.run('unbind f2');
    c.run('screenshot_key off');
    await shoot(() => c.press('F2'));
    assert.equal(calls.length, 2, 'off: no key');
    assert.match(errorsOf(c.run('screenshot_key shift+`'))[0], /opens the console/);
    assert.ok(c.run('list console').some((l) => /screenshot_key\s+off\s+Key that saves a screenshot.*\(default f12\)/.test(l)));
    c.run('unset screenshot_key');

    reply = { ok: false, text: async () => 'disk full' };
    await shoot(() => c.run('screenshot'));
    assert.ok(c.log.printed.includes('error: could not save a screenshot (disk full)'));
    assert.equal(panel().style.visibility, 'visible', 'back after a failure too');
    assert.match(errorsOf(c.run('screenshot now'))[0], /usage: screenshot \[--console\]/);
  } finally {
    c.G.fetch = realFetch;
  }
});

test('a ";" where a key name goes is the ";" key; everywhere else it ends a command', () => {
  c.run('unbind --all');
  assert.deepEqual(c.run('bind ; "heal; pos"'), ['semicolon = heal; pos']);
  assert.deepEqual(c.run('bind shift+; heal'), ['shift+semicolon = heal']);
  const pressed = c.press('Semicolon');
  assert.ok(pressed.includes('[1/2] heal') && pressed.includes('[2/2] pos'), pressed.join(' | '));
  assert.deepEqual(c.run('bind ;'), ['semicolon = heal; pos']);
  // After the key, ";" ends the command as always.
  const split = c.run('bind ;; pos');
  assert.equal(split[0], '[1/2] bind ;');
  assert.equal(split[2], '[2/2] pos');
  assert.ok(c.run('bind f heal; pos').includes('[2/2] pos'), 'unquoted, the bind ends at ";"');
  assert.deepEqual(c.run('unbind ;'), ['Unbound semicolon (was: heal; pos)']);
  assert.deepEqual(c.run('screenshot_key ;'), ['screenshot_key = semicolon']);
  assert.deepEqual(c.run('set screenshot_key shift+;'), ['screenshot_key = shift+semicolon']);
  assert.equal(c.run('set speed 2; speed')[0], '[1/2] set speed 2', 'not a key setting: splits');
  c.run('unset screenshot_key; unset speed; unbind --all');
});

test('shifted characters are Shift and their US key; keyname names the key you press', () => {
  c.run('unbind --all');
  for (const [typed, name] of [['>', 'shift+period'], ['?', 'shift+slash'], ['<', 'shift+comma'], [':', 'shift+semicolon'],
    ['!', 'shift+1'], ['{', 'shift+bracketleft'], ['|', 'shift+backslash'], ['_', 'shift+minus'], ['+', 'shift+equal'],
    ['ctrl+>', 'ctrl+shift+period'], ['shift+>', 'shift+period'], ['ctrl++', 'ctrl+shift+equal']]) {
    assert.equal(c.run(`bind ${typed} heal`)[0], `${name} = heal`, typed);
  }
  assert.match(errorsOf(c.run('bind ~ heal'))[0], /opens the console/, '~ is Shift+`');
  assert.match(errorsOf(c.run('bind ¤ heal'))[0], /not a key name.*"keyname" shows a key's name/);
  c.run('unbind --all');

  // keyname: the next key goes to it, not to binds, the screenshot key or the game.
  c.run('bind shift+period heal');
  assert.match(c.run('keyname')[0], /^Press a key/);
  assert.deepEqual(c.press('ShiftLeft', { key: 'Shift', shiftKey: true }), [], 'waits for the whole combination');
  const out = c.press('Period', { key: '>', shiftKey: true });
  assert.deepEqual(out, ['shift+period', '  types ">", code Period', '  bound to: heal', '  bind shift+period <command>'], out.join(' | '));
  assert.ok(c.press('Period', { key: '>', shiftKey: true }).some((l) => /HP = /.test(l)), 'then the bind works again');

  c.run('keyname');
  const f12 = c.press('F12', { key: 'F12' });
  assert.deepEqual(f12.slice(0, 3), ['f12', '  key "F12", code F12', '  the screenshot key ("screenshot_key")']);
  c.run('keyname');
  assert.ok(c.press('KeyW', { key: 'w' }).includes('  game key: jump'));
  c.run('keyname');
  assert.ok(c.press('Backquote', { key: '~', shiftKey: true }).includes('  cannot be bound: shift+` opens the console'));
  c.run('keyname');
  assert.deepEqual(c.press('Escape', { key: 'Escape' }), ['keyname: cancelled']);
  c.run('unbind --all');
});

test('profiles: a map\'s profile wins over your settings there, and is checked when the file is edited', async () => {
  const { profileTick } = await consoleModule('commands/profile.js');
  const atMap = (id) => { c.G[c.N.mapId] = id; };
  const saved = () => JSON.parse(c.store.get('pb2dev_kv'));
  atMap(undefined);
  assert.match(c.run('profile')[0], /^No map loaded yet/);
  assert.match(errorsOf(c.run('profile use hard'))[0], /no map loaded yet/);

  atMap('c1a');
  c.run('god on; unset max_hp');
  assert.match(c.run('profile')[0], /^Map c1a: no profile, your settings apply/);
  assert.match(c.run('profile use hard')[0], /^Map c1a uses profile "hard" \(new\): nothing yet/);
  const quiet = (line) => c.run(line).filter((l) => !l.startsWith('Note:'));
  assert.deepEqual(quiet('profile set hard god off'), ['hard: god = off']);
  assert.deepEqual(quiet('get god'), ['god = off  [profile hard, yours: on]']);
  assert.ok(c.run('list player').some((l) => /^ {2}god\s+off\s.*\[profile hard, yours: on\]/.test(l)), 'list tags it');
  const on = c.run('god on').filter((l) => !l.startsWith('Note:'));
  assert.equal(on[0], 'god = on');
  assert.match(on[1], /but profile "hard" sets god = off on this map, which wins \("profile unset hard god" to drop it\)/);

  // The game overrides read the profile too.
  c.run('profile set hard max_hp 500');
  c.frame();
  assert.equal(c.player.hmax, 500, 'max_hp from the profile');

  // Another map: yours again.
  atMap('c2a');
  assert.deepEqual(quiet('get god'), ['god = on']);
  profileTick();
  atMap('c1a');
  c.log.printed.length = 0;
  profileTick();
  assert.deepEqual(c.log.printed, ['Map c1a uses profile "hard": god off, max_hp 500']);
  atMap('c2a');
  c.log.printed.length = 0;
  profileTick();
  assert.deepEqual(c.log.printed, ['Map c2a: no profile, your settings apply']);

  assert.deepEqual(c.run('profile use hard c3a'), ['Map c3a uses profile "hard": god off, max_hp 500']);
  const listed = c.run('profile list');
  assert.ok(listed.some((l) => /^ {2}hard\s+god off, max_hp 500\s+maps: c1a, c3a$/.test(l)), listed.join(' | '));
  assert.match(errorsOf(c.run('profile set hard page_size 20'))[0], /page_size is a console key/);
  assert.match(errorsOf(c.run('profile set none god on'))[0], /"none" means no profile/);
  assert.match(errorsOf(c.run('profile set hard speed 99'))[0], /speed must be between/);
  assert.deepEqual(saved().profiles, { hard: { god: false, max_hp: 500 } });
  assert.deepEqual(saved().maps, { c1a: 'hard', c3a: 'hard' });

  assert.deepEqual(c.run('profile unset hard max_hp'), ['hard: max_hp removed, your setting applies on its maps']);
  atMap('c3a');
  assert.match(c.run('profile use none')[0], /^Map c3a: no profile \(was "hard"\), your settings apply/);
  assert.match(c.run('profile delete hard')[0], /^Deleted profile "hard"; 1 map no longer use it: c1a/);
  assert.equal(saved().profiles, undefined);

  // Edited by hand: taken as it is, and whatever is wrong is said.
  c.log.printed.length = 0;
  c.G.pb2dev.reload({
    god: true,
    profiles: { fun: { speed: 99, page_size: 5, nokey: 1, jump: 2 }, 'bad name!': {}, odd: 5 },
    maps: { c2a: 'fun', c4a: 'ghost' },
  });
  assert.deepEqual(c.log.printed, [
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
  c.G.pb2dev.fileError('Unexpected token } in JSON at position 12');
  assert.match(c.log.printed.at(-1), /cannot be read \(Unexpected token.*not saving changes to the file until it is fixed/);
  c.G.pb2dev.reload({});
  atMap(undefined);
  c.run('unset god');
});

test('profile binds win over yours on its maps; onload runs as a level on them starts', async () => {
  const { profileTick } = await consoleModule('commands/profile.js');
  const atMap = (id) => { c.G[c.N.mapId] = id; };
  const quiet = (line) => c.run(line).filter((l) => !l.startsWith('Note:'));
  const level = (on) => { c.G.stage.currentFrameLabel = on ? 'gaming' : 'menu'; };
  c.run('unbind --all');
  c.G.pb2dev.reload({});
  atMap('paul');
  profileTick(); // settle: already in a level, nothing starts

  c.run('bind shift+j heal');
  quiet('profile use pb');
  const made = quiet('profile bind pb shift+j "vars set greet "hi"; vars get greet"');
  assert.equal(made[0], 'pb: shift+j = vars set greet "hi"; vars get greet');
  assert.match(made[1], /on maps using "pb" \(paul\); it wins over your own shift\+j bind there/);
  let out = c.press('KeyJ', { shiftKey: true });
  assert.equal(out[0], '[profile pb bind shift+j] > vars set greet "hi"; vars get greet', out.join(' | '));
  assert.ok(out.includes('greet = "hi"'));
  assert.match(quiet('bind shift+j heal').join('\n'), /but profile "pb" binds shift\+j on this map, which wins there/);
  const listed = c.run('binds');
  assert.ok(listed.some((l) => /shift\+j\s+heal\s+\(not on this map: the profile's wins\)/.test(l)));
  assert.ok(listed.includes('On this map, profile "pb" binds (1):'));
  c.run('keyname');
  const named = c.press('KeyJ', { key: 'J', shiftKey: true });
  assert.ok(named.some((l) => /bound to \(profile pb, this map\): vars set greet/.test(l)), named.join(' | '));
  assert.ok(named.some((l) => /bound to \(yours, other maps\): heal/.test(l)));

  atMap('other');
  out = c.press('KeyJ', { shiftKey: true });
  assert.equal(out[0], '[bind shift+j] > heal', 'elsewhere, your bind');
  atMap('paul');

  // A ";" key in a profile bind.
  assert.deepEqual(quiet('profile bind pb ; pos'), ['pb: semicolon = pos', '  on maps using "pb" (paul); it wins over your own semicolon bind there']);
  assert.match(errorsOf(c.run('profile bind pb k nonsense'))[0], /unknown command "nonsense"/);

  // Onload: once per level start on its maps.
  const chain = 'vars set loaded 1; vars get loaded';
  assert.deepEqual(quiet(`profile onload pb "${chain}"`), [`pb onload: ${chain}`, '  runs each time a level starts on a map using "pb"']);
  const ran = () => c.log.printed.filter((l) => l.startsWith('[profile pb onload]')).length;
  c.log.printed.length = 0;
  profileTick();
  assert.equal(ran(), 0, 'nothing starts while you are already in the level');
  level(false); profileTick();
  c.log.printed.length = 0;
  level(true); profileTick();
  assert.equal(c.log.printed[0], `[profile pb onload] > ${chain}`, c.log.printed.join(' | '));
  assert.ok(c.log.printed.includes('loaded = 1'));
  c.log.printed.length = 0;
  profileTick();
  assert.equal(ran(), 0, 'once per start');
  atMap('other');
  level(false); profileTick(); level(true); c.log.printed.length = 0; profileTick();
  assert.ok(!c.log.printed.some((l) => l.includes('onload')), 'not on other maps');

  // In the file: settings, "binds" and "onload" in one object; a list is a chain.
  const saved = JSON.parse(c.store.get('pb2dev_kv'));
  assert.deepEqual(saved.profiles.pb, { binds: { 'shift+j': 'vars set greet "hi"; vars get greet', semicolon: 'pos' }, onload: chain });
  c.log.printed.length = 0;
  c.G.pb2dev.reload({ profiles: { q: { god: false, binds: { 'shift+k': 'heal', '?!': 'heal', x: 5 }, onload: ['heal', 'pos'] }, r: { onload: 7 } }, maps: { paul: 'q' } });
  assert.deepEqual(c.log.printed.slice(1), [
    'dev-overrides.json: profile "q": bind "?!": "?!" is not a key name. Examples: f, 5, f2, space, numpad1, shift+t. "keyname" shows a key\'s name; ignored',
    'dev-overrides.json: profile "q": bind "x": the command must be text; ignored',
    'dev-overrides.json: profile "r": "onload" must be commands as text (or a list of them); ignored',
  ]);
  atMap('paul');
  assert.equal(c.run('profile onload q')[0], 'q onload: heal; pos');
  assert.deepEqual(quiet('profile onload q --clear'), ['q: runs nothing on load now']);
  assert.match(quiet('profile unbind q shift+k')[0], /^q: unbound shift\+k \(was: heal\)/);
  c.G.pb2dev.reload({});
  atMap(undefined);
  c.run('unbind --all');
});

test('triggers exec runs a trigger pasted from the map editor\'s text view, once, in your game only', async () => {
  const { pasteText } = await consoleModule('ui/panel.js');
  const pasted = [
    'uid: #trigger*1016',
    'enabled: true',
    'maxcalls: -1',
    '',
    'next if VarA == ValueB( "var_suddendeath", "1" );',
    'MovableTo( "#door_a", "#spawn_spot" );',
    'next if VarA == ValueB( "var_suddendeath", ""1"" );',
    'TimerDisable( "#timer*2", "0" );',
    'op562( "a; b", "12" );',
  ].join('\r\n');
  // Pasted into the empty input: one line, "triggers exec" in front.
  const input = { value: '', selectionStart: 0, selectionEnd: 0 };
  assert.ok(pasteText(pasted, input));
  assert.equal(input.value, 'triggers exec uid: #trigger*1016 enabled: true maxcalls: -1 next if VarA == ValueB( "var_suddendeath", "1" ); '
    + 'MovableTo( "#door_a", "#spawn_spot" ); next if VarA == ValueB( "var_suddendeath", ""1"" ); TimerDisable( "#timer*2", "0" ); op562( "a; b", "12" );');
  assert.equal(input.selectionStart, input.value.length);
  assert.ok(!pasteText('pos\nheal', { value: '' }), 'commands are left to the browser');
  assert.ok(!pasteText('MovableTo( "#door_a", "#spawn_spot" );', { value: '' }), 'one line is left to the browser');

  const triggersBefore = c.G[c.N.triggers].length;
  c.log.ran.length = 0;
  c.log.net.length = 0;
  const out = c.run(input.value);
  assert.deepEqual(errorsOf(out), []);
  assert.equal(out[0], 'Ran pasted trigger "#trigger*1016" (5 actions)');
  assert.match(out[1], /^Note: ran in your game only/);
  assert.equal(c.log.ran.length, 1);
  const ran = c.log.ran[0];
  assert.equal(ran.i, triggersBefore, 'its own trigger, past the map\'s');
  assert.equal(ran.uid, '#trigger*1016');
  assert.equal(ran.by, c.G[c.N.me], 'you are the activator');
  assert.deepEqual(ran.types, [123, 0, 123, 26, 562]);
  // Targets as the map loader stores them: uids are indexes, whole numbers numbers.
  assert.deepEqual(ran.A, ['var_suddendeath', 0, 'var_suddendeath', 1, 'a; b']);
  assert.deepEqual(ran.B, [1, 3, '"1"', 0, 12]);
  assert.equal(c.G[c.N.triggers].length, triggersBefore, 'removed again');
  assert.deepEqual(c.log.net, [], 'not sent');
  assert.equal(c.G[c.N.triggerActivator], -1, 'activator put back');

  // The same in the multi-line form the editor shows (pb2dev.run, or a bind).
  c.log.ran.length = 0;
  assert.deepEqual(errorsOf(c.run(`triggers exec ${pasted}`)), []);
  assert.deepEqual(c.log.ran[0].B, [1, 3, '"1"', 0, 12]);

  // --check shows it, does not run it.
  c.log.ran.length = 0;
  const shown = c.run('triggers exec --check MovableTo( "#door_a", "#spawn_spot" );');
  assert.equal(shown[0], 'Pasted trigger script: 1 action, not run (--check)');
  assert.match(shown[1], /1\. MovableTo \(type 0\)\s+A = 0\s+B = 3\s+\(Movable › Force Movable 'A' move to region 'B'\)/);
  assert.equal(c.log.ran.length, 0);

  // Refusals, before anything runs.
  const err = (line) => errorsOf(c.run(line))[0] || '';
  assert.match(err('triggers exec TimerDisable( "#timer*999", "0" );'), /line 1: this map has no timer #timer\*999/);
  assert.match(err('triggers exec movableto( "#door_a", "#spawn_spot" );'), /unknown action "movableto"\. Did you mean MovableTo\?/);
  assert.match(err('triggers exec Nope( "a", "b" );'), /unknown action "Nope"\. "triggers actions <text>" searches/);
  assert.match(err('triggers exec SetVar( "x", "1" ); heal'), /line 2 "heal": not an action/);
  assert.match(err('triggers exec colour: red SetVar( "x", "1" );'), /unknown action "colour: red SetVar"/);
  assert.match(err('triggers exec colour: red'), /line 1 "colour: red": "colour" is not uid, enabled, maxcalls/);
  assert.match(err('triggers exec #god'), /"triggers run #god" runs that map trigger/);
  assert.match(err('triggers exec uid: #x'), /no actions in the script/);
  assert.match(err('triggers exec --bogus SetVar( "x", "1" );'), /unknown option "--bogus"/);
  assert.match(err('triggers exec'), /usage: triggers exec/);
  assert.match(err('triggers exec enabled: false SetVar( "x", "1" );'), /not run: it says "enabled: false"\. "triggers exec --force/);
  assert.equal(c.log.ran.length, 0);
  assert.deepEqual(errorsOf(c.run('triggers exec --force enabled: false SetVar( "x", "1" );')), []);
  assert.equal(c.log.ran.length, 1);
  // A "#" value that is not an object stays text: a colour, a missing trigger name.
  assert.deepEqual(errorsOf(c.run('triggers exec SetVar( "name_color", "#78dbe2" );')), []);
  assert.equal(c.log.ran[1].B[0], '#78dbe2');

  // The editor's list, searchable; triggers <#> describes actions with it.
  const listed = c.run('triggers actions timer');
  assert.match(listed[0], /^Trigger actions matching "timer": 1\./);
  assert.match(listed[1], /^\s+26\s+TimerDisable\s+Timer › Deactivate Timer 'A'\s+\[A: timer, B: nochange\]/);
  assert.match(c.run('triggers actions 562')[1], /562\s+op562\s+Debug/);
  assert.ok(c.run('triggers #god').some((l) => /type 123\s.*\(Var › Skip next trigger action/.test(l)));
});

// Every text in a fake DOM tree, depth first.
const textsOf = (node) => [node.text, ...(node.childNodes || []).flatMap((n) => (typeof n === 'string' ? [n] : textsOf(n)))].filter(Boolean);

test('editor: on and off by its key, outlines every object, selects by click and from its lists', async () => {
  const session = await consoleModule('editor/session.js');
  const { drawEditorFrame } = await consoleModule('editor/view.js');
  const { worldOfEvent } = await consoleModule('editor/input.js');
  const original = c.G[c.N.mapText];
  const overlay = c.G[c.N.uiOverlay].overlay;
  try {
    assert.match(c.run('editor')[0], /^Editor on: click an object to select it\. f8 or "editor" turns it off\./);
    assert.ok(session.editorOn());
    const first = drawEditorFrame();
    assert.ok(first.outlines > 5, JSON.stringify(first));
    assert.ok(textsOf(overlay).includes('Layers:') && textsOf(overlay).includes('Tools:'));
    // The map editor's own icons, from the site.
    const imgs = (node) => [node.src, ...(node.childNodes || []).flatMap((n) => (typeof n === 'string' ? [] : imgs(n)))].filter(Boolean);
    assert.ok(imgs(overlay).includes('/level_editor/icons16/edit.gif') && imgs(overlay).includes('/level_editor/icons16/box.gif'));
    // The map editor's thin scroll bars, from a stylesheet (inline styles cannot do it).
    const sheet = c.G.document.getElementById('pb2dev-editor-style');
    assert.match(sheet.text, /pb2dev-editor-scroll::-webkit-scrollbar \{ width: 1\.75px;/);
    assert.match(sheet.text, /-webkit-scrollbar-thumb \{ border-radius: 1\.75px; background-color: #515151;/);
    const scrollers = (n) => [n.className, ...(n.childNodes || []).flatMap((k) => (typeof k === 'string' ? [] : scrollers(k)))].filter(Boolean);
    assert.ok(scrollers(overlay).filter((cn) => cn === 'pb2dev-editor-scroll').length >= 3, 'both panels and the object box');
    // The game's CSS hides its overlay container; everything put in it must show itself.
    for (const n of overlay.childNodes) if (n.style) assert.equal(n.style.visibility, 'visible', `hidden: ${textsOf(n).slice(0, 2).join(' ')}`);
    assert.match(c.press('F8')[0], /^\[key f8\] > editor/);
    assert.ok(!session.editorOn(), 'the key turns it off');
    assert.equal(drawEditorFrame(), null);
    assert.ok(!textsOf(overlay).includes('Layers:'), 'panels gone');
    assert.equal(c.G.document.getElementById('pb2dev-editor-style'), null, 'and the stylesheet');
    c.press('F8');
    assert.ok(session.editorOn(), 'and on again');

    // A new map text (a restart, another map) is read again.
    c.G[c.N.mapText] = [
      '<box x="0" y="0" w="400" h="200" m="0" />',
      '<box x="100" y="50" w="20" h="20" m="0" />',
      '<trigger uid="#t" x="500" y="0" enabled="true" maxcalls="-1" actions_1_type="100" actions_1_targetA="a" actions_1_targetB="1" />',
      '<timer uid="#clock" x="560" y="0" enabled="true" maxcalls="-1" target="#t" delay="30" />',
    ].join('\n');
    const level = (on) => { c.G.stage.currentFrameLabel = on ? 'gaming' : 'menu'; c.frame(); };
    level(false);
    assert.ok(session.editorOn() && !session.editorShown(), 'hidden while no level runs');
    assert.equal(drawEditorFrame(), null);
    level(true);
    assert.ok(session.editorShown(), 'back with the level');
    const doc = session.editorDoc();
    assert.equal(doc.elements.length, 4);
    assert.equal(doc.toText(), c.G[c.N.mapText], 'the map text comes back as it was');

    // The smallest under the click first; the same spot again takes the next one.
    const at = { x: 110, y: 60 };
    assert.equal(doc.ordinal(session.pickAt(at)), 1);
    assert.equal(doc.ordinal(session.pickAt(at)), 0);
    assert.equal(doc.ordinal(session.pickAt(at)), 1, 'and round again');
    assert.equal(session.pickAt({ x: 1000, y: 1000 }), null, 'nothing there: deselect');
    // Screen to world and back: the fake canvas is 800x400 on screen, as wide as the game.
    const { currentTransform, toScreen } = await consoleModule('ui/overlay.js');
    const back = toScreen(currentTransform(), worldOfEvent({ clientX: 110, clientY: 60 }));
    assert.ok(Math.abs(back.x - 110) < 1e-9 && Math.abs(back.y - 60) < 1e-9, JSON.stringify(back));

    // The selection's logic links, and its params and layer in the panels.
    session.pickAt({ x: 500, y: 0 });
    assert.equal(session.selected().attrs.uid, '#t');
    assert.equal(drawEditorFrame().links, 1, 'the timer that runs it');
    assert.equal(session.currentLayer(), 'trigger');
    const texts = textsOf(overlay);
    assert.ok(texts.includes('Objects (4):') && texts.includes('#t') && texts.includes('1. SetVar') && texts.includes('A (string)'), 'the trigger\'s actions');
    assert.ok(texts.includes('1 trigger selected: #t'));

    // Esc clears the selection; a hidden layer is neither drawn nor picked.
    assert.deepEqual(c.press('Escape'), []);
    assert.equal(session.selected(), null);
    // Layers, as the map editor's: what is not on an active layer is drawn faint and
    // cannot be selected.
    session.setSelectable(session.LAYER_GROUPS.logics);
    assert.equal(drawEditorFrame().outlines, 4, 'still drawn');
    assert.equal(session.pickAt(at), null, 'walls are statics');
    assert.ok(textsOf(overlay).includes('Objects (2):'), 'the object box lists the active layers');
    session.pickAt({ x: 500, y: 0 });
    assert.equal(session.selected().attrs.uid, '#t');
    session.setSelectable(['box']);
    assert.equal(session.selected(), null, 'a selection off the active layers is let go');
    assert.equal(doc.ordinal(session.pickAt(at)), 1);
    const { KIND_TAGS } = await consoleModule('editor/kinds.js');
    // The same from the console: a group, kinds, or + and - (the editor's Ctrl and Alt).
    assert.match(c.run('editor layers entities')[0], /^Layers: player, enemy, vehicle, decoration, gun, barrel, engine mark/);
    c.run('editor layers wall');
    assert.deepEqual(session.selectableLayers(), ['box']);
    c.run('editor layers +trigger');
    c.run('editor layers -wall');
    assert.deepEqual(session.selectableLayers(), ['trigger']);
    assert.match(errorsOf(c.run('editor layers nonsense'))[0], /usage: editor layers/);
    c.run('editor layers all');
    assert.equal(session.selectableLayers().length, KIND_TAGS.length);

    // Off works without a level; on needs one.
    level(false);
    c.run('editor off');
    assert.ok(!session.editorOn());
    assert.match(errorsOf(c.run('editor'))[0], /start a level first/);
  } finally {
    c.G.stage.currentFrameLabel = 'gaming';
    c.G[c.N.mapText] = original;
    session.setEditor(false); session.forgetDocument();
  }
});

test('editor: edits go into the running level, in any mode, and again after a restart; drag moves and resizes', async () => {
  const session = await consoleModule('editor/session.js');
  const { mouse, grabOf, dragPlace } = await consoleModule('editor/input.js');
  const { currentTransform, toScreen } = await consoleModule('ui/overlay.js');
  const original = c.G[c.N.mapText];
  const quiet = (line) => c.run(line).filter((l) => !l.startsWith('Note:'));
  // A mouse event at a world point, through the screen the way a real one comes in.
  const at = (p, extra = {}) => { const s = toScreen(currentTransform(), p); return { button: 0, clientX: s.x, clientY: s.y, ...extra }; };
  try {
    // In a match (the fake game is one): the editor does not care which mode it is.
    c.run('editor on');
    const doc = session.editorDoc();
    const region = doc.byUid('#red_use'); // region #1: 400, 0, 20 x 20
    const live = c.G[c.N.regions][1];

    // Live: the game's region moves at once. The game's map text is never written.
    session.select(region);
    assert.deepEqual(quiet('editor set x 450'), ['#red_use: x = "450", live now']);
    assert.equal(live.x, 450);
    assert.equal(c.G[c.N.mapText], original);
    assert.equal(session.editorDoc(), doc, 'the editor keeps its document');
    quiet('editor set use_on 12');
    assert.equal(live[c.N.regionUseOn], 10, 'stored as the loader stores it');
    quiet('editor set use_target #locked');
    assert.equal(live[c.N.regionTrigger], c.triggers.findIndex((t) => t.uid === '#locked'));

    // Trigger actions are loaded again from the attributes.
    const trig = doc.byUid('#on_death');
    session.select(trig);
    quiet('editor set actions_1_targetB 5');
    const t = c.G[c.N.triggers][doc.ordinal(trig)];
    assert.deepEqual(t[c.N.trigTargetB], [5]);
    quiet('editor set enabled false');
    assert.equal(t[c.N.trigEnabled], false);

    // A decoration moves at once, unless a movable carries it.
    const stone = doc.elements.find((e) => e.tag === 'decor' && !e.attrs.uid);
    session.select(stone);
    assert.deepEqual(quiet('editor set x 720'), ['decoration #1: x = "720", live now']);
    assert.equal(c.G[c.N.decors][1].x, 720);
    quiet('editor set r 45');
    assert.equal(c.G[c.N.decors][1].rotation, 45);
    session.select(doc.byUid('#sign'));
    assert.match(quiet('editor set x 230')[0], /not in the running level: /, 'carried by a movable, and no game loader to build it again here');

    // Not live: kept for "editor save", and it says why.
    const door = doc.byUid('#door_a');
    session.select(door);
    assert.match(quiet('editor set w 60')[0], /^#door_a: w = "60", not in the running level: .* \(kept for "editor save"\)/);
    assert.equal(session.pendingCount(), 2);
    assert.match(errorsOf(c.run('editor set x abc'))[0], /x must be a number/);
    assert.match(errorsOf(c.run('editor set c "a"b"'))[0], /cannot contain a double quote/);

    // Drag: press on the selection, move, let go. Snaps to 10.
    mouse.down(at({ x: 210, y: 50 }));
    mouse.move(at({ x: 233, y: 64 }));
    mouse.up();
    assert.deepEqual([door.attrs.x, door.attrs.y, door.attrs.w], ['220', '10', '60']);
    // Its right edge resizes; Alt does not snap.
    assert.equal(grabOf(door, { x: 220, y: 10, w: 60, h: 100 }, { x: 279, y: 50 }, 3), 'r');
    assert.equal(grabOf(door, { x: 220, y: 10, w: 60, h: 100 }, { x: 221, y: 11 }, 3), 'lt');
    mouse.down(at({ x: 279, y: 50 }));
    mouse.move(at({ x: 301.5, y: 50 }, { altKey: true }));
    mouse.up();
    assert.deepEqual([door.attrs.x, door.attrs.w], ['220', '82.5']);
    assert.deepEqual(dragPlace({ x: 0, y: 0, w: 10, h: 10 }, 'l', 30, 0, false), { x: 10, y: 0, w: 20, h: 10 }, 'dragged past the far edge: flips');
    // An object that is not selected: the press selects it and the same press drags it.
    session.select(null);
    mouse.down(at({ x: 240, y: 60 }));
    assert.equal(session.selected(), door, 'selected on the press');
    mouse.move(at({ x: 260, y: 60 }));
    mouse.up();
    assert.equal(door.attrs.x, '240', 'and moved by the same press');
    mouse.down(at({ x: 250, y: 60 }));
    mouse.up();
    assert.equal(session.selected(), door, 'a click on the selection with nothing below it keeps it');
    quiet('editor undo');
    // A click without moving selects what is under it instead.
    mouse.down(at({ x: 400 + 50, y: 10 }));
    mouse.up();
    assert.equal(session.selected(), region);

    // The level starts again on the same map (dying, a new round): the game builds it
    // from its map text, without the edits, and the editor puts them in again.
    live.x = 400;
    live[c.N.regionUseOn] = 9;
    c.G.stage.currentFrameLabel = 'loading'; c.frame();
    c.G.stage.currentFrameLabel = 'gaming'; c.frame();
    assert.equal(session.editorDoc(), doc, 'same map: same document');
    assert.equal(live.x, 450, 'the edit is back');
    assert.equal(live[c.N.regionUseOn], 10);
    assert.equal(c.G[c.N.decors][1].rotation, 45);
    assert.equal(c.G[c.N.mapText], original);
    assert.equal(c.run('editor reload')[0].startsWith('error: '), true, 'no reload command');

    // Save goes to the wrapper (none in tests).
    c.log.printed.length = 0;
    c.G.pb2dev.run('editor save my map');
    await new Promise((r) => setTimeout(r, 10));
    assert.ok(c.log.printed.some((l) => /could not save \(no desktop wrapper in tests\)/.test(l)), c.log.printed.join(' | '));
    assert.match(errorsOf(c.run('editor save'))[0], /usage: editor save <name>/);
  } finally {
    session.setEditor(false); session.forgetDocument();
    c.G[c.N.mapText] = original;
  }
});

test('editor tools: place, copy, delete and undo; live edits still reach the right game object', async () => {
  const session = await consoleModule('editor/session.js');
  const { mouse } = await consoleModule('editor/input.js');
  const { currentTransform, toScreen } = await consoleModule('ui/overlay.js');
  const original = c.G[c.N.mapText];
  const quiet = (line) => c.run(line).filter((l) => !l.startsWith('Note:'));
  const at = (p, extra = {}) => { const s = toScreen(currentTransform(), p); return { button: 0, clientX: s.x, clientY: s.y, ...extra }; };
  try {
    c.run('editor on');
    const doc = session.editorDoc();
    const walls = () => doc.byTag('box').length;
    const before = walls();

    // Through the page, the way a real click arrives: pointer events on the game canvas,
    // whose own pointerdown listener (the game's graphics library) cancels them, so no
    // mouse event follows. The editor hears them first and keeps them from the game.
    const canvas = c.G.game_canvas;
    const shown = (p) => { const s = toScreen(currentTransform(), p); return { clientX: s.x, clientY: s.y }; };
    let reachedGame = 0;
    canvas.addEventListener('pointerdown', () => { reachedGame++; });
    c.G.onpointerdown = () => { reachedGame++; };
    const down = c.dispatch(canvas, 'pointerdown', shown({ x: 215, y: 50 }));
    c.dispatch(canvas, 'pointerup', shown({ x: 215, y: 50 }));
    assert.equal(session.selected(), doc.byUid('#door_a'), 'a real click selects');
    assert.ok(down.defaultPrevented && reachedGame === 0, 'the game never sees the click');
    delete c.G.onpointerdown;
    // A press on the editor's own panels is theirs, not a click in the world.
    const panel = c.G[c.N.uiOverlay].overlay.childNodes.find((n) => n.pb2devUi);
    c.dispatch(panel, 'pointerdown', shown({ x: 215, y: 50 }));
    c.dispatch(panel, 'pointerup', shown({ x: 215, y: 50 }));
    assert.equal(session.selected(), doc.byUid('#door_a'), 'unchanged');
    assert.match(c.run('editor status').join('\n'), /last press the window saw: .* left alone/);
    session.select(null);

    // Place tool: drag out a wall (snapped), click for a default-sized one.
    quiet('editor tool place wall');
    mouse.down(at({ x: 1003, y: 498 }));
    mouse.move(at({ x: 1150, y: 560 }));
    assert.deepEqual(session.placePreview(), { tag: 'box', x: 1000, y: 500, w: 150, h: 60 });
    mouse.up();
    assert.equal(walls(), before + 1);
    const wall = session.selected();
    assert.deepEqual(wall.attrs, { x: '1000', y: '500', w: '150', h: '60', m: '0' });
    assert.equal(session.placePreview(), null);
    mouse.down(at({ x: 2000, y: 0 }));
    mouse.up();
    assert.deepEqual([session.selected().attrs.w, session.selected().attrs.h], ['100', '100']);
    assert.match(doc.toText(), /<box x="2000" y="0" w="100" h="100" m="0" \/>/, 'in the map, for "editor save"');
    assert.deepEqual(c.press('Escape'), []);
    assert.equal(session.currentTool(), 'select', 'Esc: back to select');
    // F8 off and on again: the placed walls are still there and can be selected.
    c.press('F8'); c.press('F8');
    assert.equal(session.editorDoc(), doc, 'the same document');
    assert.equal(walls(), before + 2);
    assert.equal(session.pickAt({ x: 2050, y: 50 })?.attrs.x, '2000');

    // Add by command, with a uid numbered like the map editor's; copy gets the next one.
    assert.match(quiet('editor add region 100 200 50 50')[0], /^Added #region\*1 at 100, 200 \(50 x 50\)/);
    c.press('KeyD', { ctrlKey: true });
    assert.equal(session.selected().attrs.uid, '#region*2');
    assert.deepEqual([session.selected().attrs.x, session.selected().attrs.y], ['120', '220']);

    // Deleting a region does not shift the others in the game: the game still has it.
    session.select(doc.byUid('#button')); // region #0
    c.press('Delete');
    assert.equal(doc.byUid('#button'), null);
    const redUse = doc.byUid('#red_use');
    assert.equal(doc.ordinal(redUse), 0, 'first region of the map now');
    session.select(redUse);
    quiet('editor set y 30');
    assert.equal(c.G[c.N.regions][1].y, 30, 'still the game\'s region #1');
    assert.deepEqual([c.G[c.N.regions][0].x, c.G[c.N.regions][0][c.N.regionUseOn]], [1e7, 0], 'the deleted one out of play, the others where they were');
    // New elements are not in the game: never live.
    session.select(doc.byUid('#region*1'));
    assert.match(quiet('editor set x 150')[0], /not in the running level: it is not in the running level yet/);

    // Undo: one step per action; a whole drag is one.
    session.select(wall);
    mouse.down(at({ x: 1075, y: 530 }));
    mouse.move(at({ x: 1100, y: 530 }));
    mouse.move(at({ x: 1125, y: 530 }));
    mouse.up();
    assert.equal(wall.attrs.x, '1050');
    c.press('KeyZ', { ctrlKey: true });
    assert.equal(wall.attrs.x, '1000', 'the drag, at once');
    c.press('KeyY', { ctrlKey: true });
    assert.equal(wall.attrs.x, '1050');
    quiet('editor undo'); // the drag
    quiet('editor undo'); // x 150 of #region*1
    quiet('editor undo'); // y 30
    assert.equal(c.G[c.N.regions][1].y, 0, 'undo goes live too');
    quiet('editor undo'); // the delete
    assert.equal(doc.ordinal(doc.byUid('#button')), 0, 'back where it was');
    assert.equal(session.selected(), doc.byUid('#button'));
    while (session.editorDoc().byTag('box').length > before) quiet('editor undo');
    assert.equal(doc.byUid('#region*1'), null);
    assert.equal(c.run('editor undo')[0], 'Nothing to undo');
    assert.equal(doc.toText(), original, 'the map as it was');

    assert.match(errorsOf(c.run('editor add nonsense'))[0], /usage: editor add <kind>/);
    session.select(null);
    assert.match(errorsOf(c.run('editor delete'))[0], /select an object first/);
  } finally {
    session.setTool('select');
    session.setEditor(false); session.forgetDocument();
    c.G[c.N.mapText] = original;
  }
});

test('logic: old maps without uids link by number, as the game reads them', async () => {
  const { buildGraph, findNode } = await consoleModule('logic/graph.js');
  const old = [
    '<player x="0" y="0" ondeath="1" />',
    '<enemy x="50" y="0" ondeath="-1" />',
    '<door x="100" y="0" w="20" h="20" />',
    '<region x="0" y="0" w="20" h="20" use_target="0" use_on="1" />',
    '<region x="40" y="0" w="20" h="20" use_target="0" use_on="1" uses_timer="true" />',
    '<region x="80" y="0" w="20" h="20" use_target="-1" use_on="0" attach="0" />',
    '<trigger enabled="true" maxcalls="1" actions_1_type="0" actions_1_targetA="0" actions_1_targetB="2" actions_2_type="26" actions_2_targetA="0" actions_2_targetB="0" actions_3_type="100" actions_3_targetA="0" actions_3_targetB="1" />',
    '<trigger enabled="true" maxcalls="1" />',
    '<timer enabled="true" maxcalls="1" target="1" delay="30" />',
  ].join('\n');
  const g = buildGraph(old);
  const links = g.links.map((l) => `${l.from.uid} -> ${l.to.uid} (${l.kind}, ${l.label})`).sort();
  assert.deepEqual(links, [
    'player#0 -> trigger#1 (start, ondeath)',
    'region#0 -> trigger#0 (start, use_target)',
    'region#1 -> timer#0 (start, use_target)',
    'region#2 -> door#0 (attach, attach)',
    'timer#0 -> trigger#1 (start, target)',
    'trigger#0 -> door#0 (act, action 1: 0)',
    'trigger#0 -> region#2 (act, action 1: 0)',
    'trigger#0 -> timer#0 (control, action 2: 26 disable timer A)',
  ], 'variable names (type 100) are text, not references; -1 is none');
  assert.equal(findNode(g, 'REGION#1').uid, 'region#1');
  assert.equal(findNode(g, '1'), g.byIndex.get('trigger')[1], 'a trigger by index');
  assert.equal(g.byIndex.get('character')[1].tag, 'enemy', 'players and enemies share the characters');
  // Triggers and timers without a place sit in a row above the map's top left corner.
  const spot = (n) => [n.x, n.y];
  assert.deepEqual(spot(g.byIndex.get('trigger')[0]), [0, -60]);
  assert.deepEqual(spot(g.byIndex.get('trigger')[1]), [40, -60]);
  assert.deepEqual(spot(g.byIndex.get('timer')[0]), [80, -60]);

  // The editor draws them too.
  const session = await consoleModule('editor/session.js');
  const { drawEditorFrame } = await consoleModule('editor/view.js');
  const original = c.G[c.N.mapText];
  try {
    c.run('editor on');
    c.G[c.N.mapText] = old;
    c.G.stage.currentFrameLabel = 'menu'; c.frame();
    c.G.stage.currentFrameLabel = 'gaming'; c.frame();
    const doc = session.editorDoc();
    assert.deepEqual(doc.byTag('timer')[0].spot, { x: 80, y: -60 }, 'where "logic show" draws it');
    session.select(doc.byTag('trigger')[0]);
    assert.equal(drawEditorFrame().links, 4, 'a region runs it; it moves a door to a region, disables a timer');
    assert.deepEqual(errorsOf(c.run('editor status')), []);
  } finally {
    session.setEditor(false); session.forgetDocument();
    c.G[c.N.mapText] = original;
  }
});

test('editor: walls (with trims), backgrounds, water, pushers and movables move in the running level', async () => {
  const session = await consoleModule('editor/session.js');
  const original = c.G[c.N.mapText];
  const G = c.G, N = c.N;
  const quiet = (line) => c.run(line).filter((l) => !l.startsWith('Note:'));
  const level = (on) => { G.stage.currentFrameLabel = on ? 'gaming' : 'menu'; c.frame(); };
  // A level as the game holds it after loading: two walls, a background, water, a
  // pusher and a movable.
  G[N.mapText] = [
    '<box x="0" y="0" w="200" h="20" m="0" />',
    '<box x="300" y="0" w="100" h="40" m="0" />',
    '<bg x="0" y="100" w="50" h="50" m="0" />',
    '<water uid="#pool" x="600" y="0" w="100" h="50" damage="0" friction="true" />',
    '<pushf uid="#fan" x="800" y="0" w="40" h="40" tox="0" toy="-1" stab="0" damage="0" attach="-1" />',
    '<door uid="#lift" x="500" y="0" w="40" h="10" moving="false" tarx="500" tary="-100" maxspeed="10" vis="true" attach="-1" />',
  ].join('\n');
  G[N.wallX] = [0, 300]; G[N.wallY] = [0, 0]; G[N.wallW] = [200, 100]; G[N.wallH] = [20, 40]; G[N.wallCount] = 2;
  // The loader's grid: 100-unit cells, from 200 left of and above the walls.
  Object.assign(G, { [N.gridCell]: 100, [N.gridMinX]: -200, [N.gridMinY]: -200, [N.gridCols]: 12, [N.gridRows]: 6 });
  G[N.grid] = Array.from({ length: 12 }, () => Array.from({ length: 6 }, () => []));
  G[N.gridAddWall] = (i) => {
    const x0 = Math.floor((G[N.wallX][i] - 100 + 200) / 100), x1 = Math.ceil((G[N.wallX][i] + G[N.wallW][i] + 100 + 200) / 100);
    const y0 = Math.floor((G[N.wallY][i] - 100 + 200) / 100), y1 = Math.ceil((G[N.wallY][i] + G[N.wallH][i] + 100 + 200) / 100);
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) G[N.grid][x][y].push(i);
  };
  G[N.gridAddWall](0); G[N.gridAddWall](1);
  // The drawn layers: a wall body each, and one shared sprite with a background's
  // rectangle and wall #1's top and bottom trims, as the loader records the calls.
  G.texture_front0 = class {};
  const body = Object.assign(new G.texture_front0(), { x: 300, y: 0, scaleX: 1, scaleY: 0.4 });
  const fill = (ty, tx = 0) => ['beginBitmapFill', [{}, { tx, ty }, true, true]];
  const quad = (x1, y1, x2, y2) => [['moveTo', [x1, y1]], ['lineTo', [x2, y1]], ['lineTo', [x2, y2]], ['lineTo', [x1, y2]], ['endFill', []]];
  let scheduled = 0;
  const shared = { graphics: { bounds: { x1: 0, y1: 0, x2: 0, y2: 0 }, ScheduleBitmapUpdate() { scheduled++; }, draw_operations: [
    fill(100), ...quad(0, 100, 50, 150), // the background
    fill(0), ...quad(300, 0, 400, 16), // wall #1, top
    fill(24), ...quad(300, 24, 400, 40), // wall #1, bottom (40 - 16)
    fill(0), ...quad(0, 0, 200, 16), // wall #0, top: not wall #1's
  ] } };
  G.graphics_3d = { children: [body, shared] };
  const pool = { x: 600, y: 0, scaleX: 1, scaleY: 0.5 };
  G[N.waters] = [pool]; G[N.waterCount] = 1;
  G[N.waterX] = [590]; G[N.waterY] = [0]; G[N.waterW] = [120]; G[N.waterH] = [60]; G[N.waterDamage] = [0];
  G[N.bgX] = [0]; G[N.bgY] = [100]; G[N.bgW] = [50]; G[N.bgH] = [50]; G[N.bgCount] = 1;
  Object.assign(G, { [N.pushX1]: [800], [N.pushY1]: [0], [N.pushX2]: [840], [N.pushY2]: [40], [N.pushCount]: 1,
    [N.pushToX]: [0], [N.pushToY]: [-1], [N.pushStab]: [0], [N.pushDamage]: [0] });
  const lift = { x: 500, y: 0, w: 40, h: 10, scaleX: 0.4, scaleY: 0.1, tarx: 500, tary: -100 };
  G[N.doors] = [lift]; G[N.doorCount] = 1;
  // The cells wall i is in, against the cells the game's own function would put it in.
  const cellsOf = (grid, i) => grid.flatMap((col, x) => col.map((cell, y) => (cell.includes(i) ? `${x},${y}` : null))).filter(Boolean);
  const freshCells = (i) => {
    const real = G[N.grid];
    G[N.grid] = real.map((col) => col.map(() => []));
    G[N.gridAddWall](i);
    const want = cellsOf(G[N.grid], i);
    G[N.grid] = real;
    return want;
  };
  const ops = () => shared.graphics.draw_operations;
  const points = (from, n = 4) => ops().slice(from, from + n).map((op) => op[1].slice(0, 2));
  try {
    c.run('editor on');
    level(false); level(true);
    const doc = session.editorDoc();

    // A wall, in a match: arrays, grid, body, trims. Its height: the top stays, the bottom
    // trim follows the bottom edge.
    const wall = doc.byTag('box')[1];
    session.select(wall);
    assert.deepEqual(quiet('editor set h 60'), ['wall #1: h = "60", live now']);
    assert.equal(G[N.wallH][1], 60);
    assert.equal(body.scaleY, 0.6);
    assert.deepEqual(points(7), [[300, 0], [400, 0], [400, 16], [300, 16]], 'top trim stays');
    assert.deepEqual(points(13), [[300, 44], [400, 44], [400, 60], [300, 60]], 'bottom trim moves down 20');
    assert.equal(ops()[12][1][1].ty, 44, 'its texture with it');
    // Moved: everything of it goes along; wall #0's trim stays.
    quiet('editor set x 350');
    assert.deepEqual([G[N.wallX][1], body.x], [350, 350]);
    assert.deepEqual(points(7)[0], [350, 0]);
    assert.deepEqual(points(13)[0], [350, 44]);
    assert.deepEqual(points(19)[0], [0, 0], 'the other wall\'s trim untouched');
    assert.deepEqual(cellsOf(G[N.grid], 1), freshCells(1), 'in exactly the cells the game lists it in');
    assert.deepEqual(cellsOf(G[N.grid], 0), freshCells(0), 'the other wall untouched');
    // Wider: trims stretch with it.
    quiet('editor set w 200');
    assert.deepEqual(points(7), [[350, 0], [550, 0], [550, 16], [350, 16]]);
    assert.ok(scheduled > 0, 'the layer is redrawn');
    assert.match(quiet('editor set x 5000')[0], /not in the running level: that is outside the area the level's walls were built for/);
    assert.equal(G[N.wallX][1], 350);
    quiet('editor undo');

    // A background: its arrays and its drawn rectangle.
    session.select(doc.byTag('bg')[0]);
    assert.deepEqual(quiet('editor set y 120'), ['background #0: y = "120", live now']);
    assert.deepEqual(points(1), [[0, 120], [50, 120], [50, 170], [0, 170]]);
    assert.equal(G[N.bgY][0], 120);

    // Water: shown at the map's place, acting on a wider area, as the loader does.
    session.select(doc.byUid('#pool'));
    quiet('editor set w 200');
    assert.deepEqual([pool.scaleX, G[N.waterX][0], G[N.waterW][0], G[N.waterH][0]], [2, 590, 220, 60]);
    // Its damage builds it again (shown as acid): that test has a loader with water.

    // A pusher: its corners and its push.
    session.select(doc.byUid('#fan'));
    quiet('editor set x 820');
    assert.deepEqual([G[N.pushX1][0], G[N.pushX2][0]], [820, 860]);
    quiet('editor set toy -3');
    assert.equal(G[N.pushToY][0], -3);

    // A movable: place, size and destination.
    session.select(doc.byUid('#lift'));
    quiet('editor set w 80');
    quiet('editor set tary -200');
    assert.deepEqual([lift.w, lift.scaleX, lift.tary], [80, 0.8, -200]);

    // A new wall: its arrays, its grid cells and a body, as the loader makes one.
    G.graphics_3d.numChildren = G.graphics_3d.children.length;
    G.graphics_3d.addChildAt = function addChildAt(child) { this.children.push(child); child.parent = this; return child; };
    G.graphics_3d.removeChild = function removeChild(child) { this.children.splice(this.children.indexOf(child), 1); };
    G[N.displayInit] = (shown) => { shown.mouseEnabled = false; };
    G[N.wallMaterial] = ['0', '0'];
    c.run('editor add wall 100 100 50 20');
    const newWall = session.selected();
    assert.equal(newWall.live.index, 2);
    assert.deepEqual([G[N.wallCount], G[N.wallX][2], G[N.wallW][2]], [3, 100, 50]);
    assert.deepEqual(cellsOf(G[N.grid], 2), freshCells(2), 'in the grid');
    const newBody = G.graphics_3d.children.at(-1);
    assert.deepEqual([newBody.x, newBody.scaleX, newBody.mouseEnabled], [100, 0.5, false]);
    // Deleted: out of the grid, no size, its body gone.
    c.press('Delete');
    assert.deepEqual(cellsOf(G[N.grid], 2), []);
    assert.equal(G[N.wallW][2], 0);
    assert.ok(!G.graphics_3d.children.includes(newBody));
    c.run('editor undo'); c.run('editor undo');

    // The level starts again on the same map: the game rebuilds it without the edits,
    // and the editor puts them in again.
    G[N.wallX] = [0, 300]; G[N.wallW] = [200, 100]; G[N.wallH] = [20, 40];
    G[N.grid] = Array.from({ length: 12 }, () => Array.from({ length: 6 }, () => []));
    G[N.gridAddWall](0); G[N.gridAddWall](1);
    Object.assign(body, { x: 300, scaleX: 1, scaleY: 0.4 });
    lift.w = 40; G[N.pushToY][0] = -1;
    level(false); level(true);
    assert.deepEqual([G[N.wallX][1], G[N.wallW][1], G[N.wallH][1], body.x], [350, 200, 60, 350], 'the wall again');
    assert.deepEqual(cellsOf(G[N.grid], 1), freshCells(1));
    assert.deepEqual([lift.w, G[N.pushToY][0]], [80, -3]);
  } finally {
    session.setEditor(false); session.forgetDocument();
    G[N.mapText] = original;
    for (const k of ['doors', 'doorCount', 'wallCount', 'waters', 'waterCount', 'bgCount', 'pushCount']) delete G[N[k]];
    delete G.graphics_3d;
  }
});

test('the anti-cheat scan report is logged as the game sends it, once', () => {
  const { G, N } = c;
  const net = G[N.net];
  const walls = [0, 300];
  G[N.wallX] = walls;
  G[N.lockedArrays].push([], walls);
  const warned = [];
  const realWarn = console.warn;
  console.warn = (...a) => warned.push(a.join(' '));
  try {
    // The game's own ping (2 parts), then the scan's report for locked array 1.
    net[N.netLog].push({ type: 'PING', parts: ['PING', '7'], time: 1 });
    net[N.netLog].push({ type: 'PING', parts: ['PING', 'undefined', '3', '1'], time: 2 });
    c.frame(2);
    assert.equal(warned.length, 1, warned.join(' | '));
    assert.match(warned[0], /^\[anti-cheat\] scan report sent.*code 3 \(a locked array changed\): locked array 1 of 2 \(wallX\)$/);
    net[N.netLog].push({ type: 'PING', parts: ['PING', 'undefined', '2', '5/old/new'], time: 3 });
    c.frame();
    assert.match(warned[1], /code 2 \(a function changed\): 5\/old\/new$/);
  } finally {
    console.warn = realWarn;
    G[N.lockedArrays].length = 0;
  }
});

test('editor: a trigger\'s actions are added, changed and removed, or edited as the map editor\'s text', async () => {
  const session = await consoleModule('editor/session.js');
  const { actionsOf, actionValues, triggerText, valuesFromText } = await consoleModule('editor/actions.js');
  const { setAttrs, undo } = await consoleModule('editor/edit.js');
  const original = c.G[c.N.mapText];
  const level = (on) => { c.G.stage.currentFrameLabel = on ? 'gaming' : 'menu'; c.frame(); };
  try {
    c.run('editor on');
    c.G[c.N.mapText] = '<trigger uid="#t" x="0" y="0" enabled="true" maxcalls="1" actions_1_type="100" actions_1_targetA="a" actions_1_targetB="1" actions_2_type="-1" actions_2_targetA="" actions_2_targetB="" actions_3_type="26" actions_3_targetA="#clock" actions_3_targetB="0" />';
    level(false); level(true);
    const t = session.editorDoc().byUid('#t');
    // Empty slots (type -1) are not actions.
    assert.deepEqual(actionsOf(t.attrs), [{ type: '100', A: 'a', B: '1' }, { type: '26', A: '#clock', B: '0' }]);
    // The text view, as the map editor writes it.
    assert.equal(triggerText(t.attrs), 'uid: #t\nenabled: true\nmaxcalls: 1\n\nSetVar( "a", "1" );\nTimerDisable( "#clock", "0" );');
    // Add one: renumbered from 1, the empty slot gone; one undo step.
    setAttrs(t, actionValues(t.attrs, [...actionsOf(t.attrs), { type: 0, A: '#door', B: '#spot' }]));
    assert.deepEqual([t.attrs.actions_2_type, t.attrs.actions_3_type, t.attrs.actions_3_targetB], ['26', '0', '#spot']);
    assert.ok(!t.attrs.actions_4_type);
    undo();
    assert.equal(t.attrs.actions_2_type, '-1', 'undo puts the slots back as they were');
    // Edit as text, apply: headers and actions replaced.
    setAttrs(t, valuesFromText(t.attrs, 'uid: #t\nenabled: false\nmaxcalls: -1\n\nMovableTo( "#door", "#spot" );'));
    assert.deepEqual([t.attrs.enabled, t.attrs.maxcalls, t.attrs.actions_1_type, t.attrs.actions_1_targetA], ['false', '-1', '0', '#door']);
    assert.ok(!('actions_2_type' in t.attrs) && !('actions_3_type' in t.attrs));
    assert.throws(() => valuesFromText(t.attrs, 'Nope( "a", "b" );'), /unknown action "Nope"/);
    // The params panel in text mode: the text view and its Apply.
    const { setTriggersAsText } = await consoleModule('editor/trigger-panel.js');
    setTriggersAsText(true);
    session.select(null); session.select(t);
    const texts = textsOf(c.G[c.N.uiOverlay].overlay);
    assert.ok(texts.includes('Edit triggers as text:') && texts.includes('Apply') && texts.includes('Edit triggers as param list'));
    setTriggersAsText(false);
    // A trigger with no actions at all is fine too.
    setAttrs(t, valuesFromText(t.attrs, 'uid: #t'));
    assert.deepEqual(actionsOf(t.attrs), []);
  } finally {
    session.setEditor(false); session.forgetDocument();
    c.G[c.N.mapText] = original;
  }
});

test('editor: Params shows every parameter of the kind, with the editor\'s titles, defaults and values', async () => {
  const session = await consoleModule('editor/session.js');
  const original = c.G[c.N.mapText];
  const level = (on) => { c.G.stage.currentFrameLabel = on ? 'gaming' : 'menu'; c.frame(); };
  try {
    c.run('editor on');
    c.G[c.N.mapText] = '<region x="0" y="0" w="10" h="10" use_on="1" />'; // an old map: no uid, no use_target, no attach
    level(false); level(true);
    session.select(session.editorDoc().byTag('region')[0]);
    const texts = textsOf(c.G[c.N.uiOverlay].overlay);
    for (const t of ['ID', 'X', 'Activation Trigger', 'Activation on', 'attach', "1 (''USE'' key (with button))", '-1']) {
      assert.ok(texts.includes(t), `${t}: ${texts.slice(-30).join(' | ')}`);
    }
  } finally {
    session.setEditor(false); session.forgetDocument();
    c.G[c.N.mapText] = original;
  }
});

test('editor: an object parameter is picked by clicking the object in the world, as in the map editor', async () => {
  const session = await consoleModule('editor/session.js');
  const { drawEditorFrame } = await consoleModule('editor/view.js');
  const { currentTransform, toScreen } = await consoleModule('ui/overlay.js');
  const overlay = c.G[c.N.uiOverlay].overlay;
  // The node whose own text is `text`, and the params row it is in.
  const find = (node, text) => {
    if (node.text === text) return node;
    for (const n of node.childNodes || []) { const hit = typeof n === 'object' && find(n, text); if (hit) return hit; }
    return null;
  };
  const valueCell = (label) => find(overlay, label).parent.childNodes[1];
  const shown = (p) => { const s = toScreen(currentTransform(), p); return { clientX: s.x, clientY: s.y }; };
  const click = (p) => { c.dispatch(c.G.game_canvas, 'pointerdown', shown(p)); c.dispatch(c.G.game_canvas, 'pointerup', shown(p)); };
  try {
    c.run('editor on');
    const doc = session.editorDoc();
    const region = doc.byUid('#red_use');
    session.select(region);
    c.dispatch(valueCell('Activation Trigger'), 'click', {});
    assert.deepEqual(session.currentPick().kinds, ['trigger']);
    assert.ok(drawEditorFrame().picks > 0, 'every trigger is marked');
    assert.match(textsOf(overlay).join('\n'), /use_target: click a trigger in the world {2}· {2}Esc: cancel/);
    click({ x: 120, y: 0 }); // #locked is at 120, 0
    assert.equal(region.attrs.use_target, '#locked');
    assert.equal(c.G[c.N.regions][1][c.N.regionTrigger], c.triggers.findIndex((t) => t.uid === '#locked'), 'live');
    assert.equal(session.currentPick(), null, 'done');
    assert.equal(session.selected(), region, 'the region stays selected');
    // Esc cancels one.
    c.dispatch(valueCell('Activation Trigger'), 'click', {});
    assert.ok(session.currentPick());
    c.press('Escape');
    assert.equal(session.currentPick(), null);
    assert.equal(session.selected(), region, 'Esc ends the pick, not the selection');
    // A trigger action's target: B of MovableTo is a region.
    const trigger = doc.byUid('#open_door');
    session.select(trigger);
    c.dispatch(valueCell('B (region)'), 'click', {});
    assert.deepEqual(session.currentPick().kinds, ['region']);
    click({ x: 50, y: 0 }); // the #open_door trigger is here: not a region
    assert.ok(session.currentPick(), 'only the kinds it takes');
    click({ x: 490, y: 10 }); // #spawn_spot: 480, 0, 20 x 20
    assert.equal(trigger.attrs.actions_2_targetB, '#spawn_spot');
    // A pick with nothing there keeps waiting.
    c.dispatch(valueCell('A (door)'), 'click', {});
    click({ x: 330, y: 150 }); // on screen, nothing there
    assert.ok(session.currentPick(), 'still waiting');
    c.press('Escape');
    c.run('editor undo'); c.run('editor undo');
  } finally {
    session.setEditor(false); session.forgetDocument();
  }
});

test('editor: the selection\'s connections are dashed lines as in the map editor: green out, white in', async () => {
  const session = await consoleModule('editor/session.js');
  const { drawEditorFrame } = await consoleModule('editor/view.js');
  const original = c.G[c.N.mapText];
  const level = (on) => { c.G.stage.currentFrameLabel = on ? 'gaming' : 'menu'; c.frame(); };
  // The stroke colour and dash in force at each line drawn.
  const strokes = () => {
    const out = [];
    let color = null;
    let dash = [];
    for (const d of c.log.drawn) {
      if (d[0] === 'set' && d[1] === 'strokeStyle') color = d[2];
      if (d[0] === 'setLineDash') dash = d[1];
      if (d[0] === 'lineTo') out.push({ color, dash: dash.length > 0 });
    }
    return out;
  };
  try {
    c.run('editor on');
    c.G[c.N.mapText] = [
      '<trigger uid="#t" x="0" y="0" enabled="true" maxcalls="1" actions_1_type="26" actions_1_targetA="#clock" actions_1_targetB="0" />',
      '<timer uid="#clock" x="100" y="0" enabled="true" maxcalls="-1" target="#t" delay="30" />',
    ].join('\n');
    level(false); level(true);
    session.select(session.editorDoc().byUid('#t'));
    c.log.drawn.length = 0;
    assert.equal(drawEditorFrame().links, 2, 'it disables the timer; the timer runs it');
    const lines = strokes();
    assert.ok(lines.some((l) => l.color === '#66ff66' && l.dash), 'green, dashed: what it points at');
    assert.ok(lines.some((l) => l.color === '#ffffff' && l.dash), 'white, dashed: what points at it');
    assert.ok(!c.log.drawn.some((d) => d[0] === 'closePath'), 'no arrowheads');
  } finally {
    session.setEditor(false); session.forgetDocument();
    c.G[c.N.mapText] = original;
  }
});

test('editor: an edit nothing finer takes rebuilds the object with the game\'s own loader code', async () => {
  const session = await consoleModule('editor/session.js');
  const loader = await consoleModule('editor/loader.js');
  const G = c.G, N = c.N;
  // A frame2.js shaped like the game's: tags through its string table, a loop that
  // builds (a branch per kind, a counter each), a loop that resolves uids.
  G.$tagBox = 'box'; G.$tagRegion = 'region'; G.$tagDecor = 'decor';
  const frame2 = `
var a,b,c;
for(var $el of $doc.children())
{
if(a==$tagBox)
{
$wallsBuilt++;
}
if(a==$tagRegion)
{
${N.regions}[$regionN]=new Object();
${N.regions}[$regionN]["x"]=parseFloat(b["#x"]);
${N.regions}[$regionN]["y"]=parseFloat(b["#y"]);
${N.regions}[$regionN].w=parseFloat(b["#w"]);
${N.regions}[$regionN].h=parseFloat(b["#h"]);
${N.regions}[$regionN].${N.regionTrigger}=b["#use_target"];
${N.regions}[$regionN].${N.regionUseOn}=parseInt(b["#use_on"]);
if(${N.regions}[$regionN].${N.regionUseOn}==1)
{
mc={ kind: "switch", parent: { removeChild(x) { x.gone = true; } } };
${N.regions}[$regionN].mc=mc;
}
$regionN++;
}
}
for(var $el of $doc.children())
{
if(a==$tagRegion)
{
${N.regions}[$regionR].${N.regionTrigger}="resolved " + ${N.regions}[$regionR].${N.regionTrigger};
$regionR++;
}
}
`;
  const regions = G[N.regions];
  G.$regionN = regions.length; G.$regionR = regions.length; G.$wallsBuilt = 0;
  G.a = 'the game\'s a'; G.mc = 'the game\'s mc';
  await loader.readLoader(async (url) => ({ ok: url === 'scripts/frame2.js', status: 200, text: async () => frame2 }));
  assert.ok(loader.loaderReady(), loader.loaderProblem());
  assert.ok(loader.canRebuild('region') && !loader.canRebuild('gun'));
  try {
    c.run('editor on');
    const doc = session.editorDoc();
    const region = doc.byUid('#clock_switch'); // region #2 of 4, a use key
    session.select(region);
    c.run('editor set use_on 0'); // switch -> none: nothing finer can take it
    const before = regions[2];
    // Activation 0 -> 1: the game's region branch draws a USE switch.
    assert.deepEqual(c.run('editor set use_on 1').filter((l) => !l.startsWith('Note:')), ['#clock_switch: use_on = "1", live now']);
    assert.notEqual(regions[2], before, 'a new region object from the game\'s code');
    assert.equal(regions[2].mc.kind, 'switch');
    assert.equal(regions[2].x, 440);
    assert.equal(regions[2][N.regionTrigger], 'resolved #timer*2', 'the second loop ran too');
    assert.deepEqual([G.$regionN, G.$regionR], [regions.length, regions.length], 'counters as they were');
    assert.deepEqual([G.a, G.mc], ['the game\'s a', 'the game\'s mc'], 'its scratch globals as they were');
    // And back: the old switch comes off the screen.
    const sw = regions[2].mc;
    c.run('editor set use_on 0');
    assert.ok(sw.gone);
    assert.equal(regions[2].mc, undefined);

    // Adding one: the game's branch at the end of the regions, its counters moved on.
    const n = regions.length;
    c.run('editor add region 600 0 40 40');
    const added = session.selected();
    assert.equal(added.live.index, n);
    assert.equal(regions.length, n + 1);
    assert.deepEqual([regions[n].x, regions[n].w, G.$regionN, G.$regionR], [600, 40, n + 1, n + 1]);
    assert.equal(session.pendingCount(), 0, 'in the running level');
    // Deleting it: out of play, the others where they were; undo builds it again.
    c.press('Delete');
    assert.deepEqual([regions[n].x, regions.length], [1e7, n + 1]);
    c.run('editor undo');
    assert.equal(regions[n].x, 600, 'built again in its place');
    assert.equal(regions.length, n + 1);
    // The level starts over on the same map: the game builds its regions from the map
    // (no added one), and the editor adds it again.
    regions.length = n; G.$regionN = n; G.$regionR = n;
    c.G.stage.currentFrameLabel = 'menu'; c.frame();
    c.G.stage.currentFrameLabel = 'gaming'; c.frame();
    assert.deepEqual([regions.length, regions[n].x], [n + 1, 600], 'added again after the restart');
    // A deleted map region is taken out again after a restart too.
    session.select(doc.byUid('#spawn_spot'));
    c.press('Delete');
    regions[3].x = 480; // the game builds the level again from the map
    regions.length = n; G.$regionN = n; G.$regionR = n;
    c.G.stage.currentFrameLabel = 'menu'; c.frame();
    c.G.stage.currentFrameLabel = 'gaming'; c.frame();
    assert.equal(regions[3].x, 1e7, 'still out of play');
    assert.equal(regions[n].x, 600, 'and the added one added again');
    c.run('editor undo');
    c.run('editor undo'); // the add
    assert.equal(regions[n].x, 1e7);
  } finally {
    session.setEditor(false); session.forgetDocument();
    for (const k of ['$tagBox', '$tagRegion', '$tagDecor', '$regionN', '$regionR', '$wallsBuilt']) delete G[k];
  }
});

test('editor: a map gun moves, changes model, is deleted and comes back in the running level', async () => {
  const session = await consoleModule('editor/session.js');
  const G = c.G, N = c.N;
  const original = G[N.mapText];
  const level = (on) => { G.stage.currentFrameLabel = on ? 'gaming' : 'menu'; c.frame(); };
  const quiet = (line) => c.run(line).filter((l) => !l.startsWith('Note:'));
  // A rifle lying on the map (fallen a little since), with its two physics points, and
  // one a character holds.
  const X = G[N.ptX], Y = G[N.ptY], PX = G[N.ptPrevX], PY = G[N.ptPrevY];
  X[20] = 100; Y[20] = 30; X[21] = 110; Y[21] = 30; PX[20] = 100; PY[20] = 30; PX[21] = 110; PY[21] = 30;
  const rifle = { model: 'gun_rifle', x: 100, y: 30, picken_by: -1, [N.gunPtA]: 20, [N.gunPtB]: 21 };
  const held = { model: 'gun_rifle', x: 101, y: 0, picken_by: 0 };
  G[N.guns] = [held, rifle];
  const made = [];
  const factory = G[N.gunFactory];
  G[N.gunFactory] = (model, params) => { const g = { model, x: params.x, y: params.y, upg: params.upg, picken_by: -1 }; made.push(g); G[N.guns].push(g); return g; };
  try {
    G[N.mapText] = '<gun uid="#rifle" x="100" y="0" model="gun_rifle" command="-1" upg="0" />';
    c.run('editor on');
    level(false); level(true);
    const gun = session.editorDoc().byUid('#rifle');
    session.select(gun);
    // Moved: its points go along, the held one is not touched.
    assert.deepEqual(quiet('editor set x 300'), ['#rifle: x = "300", live now']);
    assert.deepEqual([rifle.x, X[20], X[21], PX[20]], [300, 300, 310, 300]);
    assert.equal(held.x, 101);
    // A new model: a new gun from the game's factory where it lies; the old one out of play.
    assert.deepEqual(quiet('editor set model gun_sniper'), ['#rifle: model = "gun_sniper", live now']);
    assert.deepEqual([made.length, made[0].model, made[0].x], [1, 'gun_sniper', 300]);
    assert.ok(rifle.x >= 1e7 && rifle.visible === false);
    // Deleted, and back with undo where the map puts it.
    c.press('Delete');
    assert.ok(made[0].x >= 1e7);
    c.run('editor undo');
    assert.deepEqual([made.length, made[1].model, made[1].x], [2, 'gun_sniper', 300]);
  } finally {
    session.setEditor(false); session.forgetDocument();
    G[N.gunFactory] = factory;
    G[N.guns] = [];
    G[N.mapText] = original;
  }
});

test('editor: decoration models and character skins are offered as the editor offers them, with their pictures', async () => {
  const { dropdownItems } = await consoleModule('editor/params.js');
  const table = globalThis.PB2_OPCODES;
  table.values.decor_model = { stone: 'Stone', ship: 'Broken ship' };
  table.values.char = { 1: 'Campaign Hero model', 77: 'Raven', '-1': 'Death Match model' };
  try {
    const decor = dropdownItems('decor_model');
    assert.deepEqual(decor.map((i) => [i.value, i.label, i.picture.src]), [
      ['stone', 'Stone', '/level_editor/decors/stone.png'], ['ship', 'Broken ship', '/level_editor/decors/ship.png'],
    ]);
    const skins = dropdownItems('char');
    assert.deepEqual(skins.map((i) => [i.value, i.picture?.src ?? null]), [
      ['1', '/level_editor/chars_full/char0001.png'], ['77', '/level_editor/chars_full/char0077.png'], ['-1', null],
    ]);
  } finally {
    delete table.values.decor_model;
    delete table.values.char;
  }
});

test('editor: a lamp is found by its place, built again in its slot, its light and flare drawn with the game\'s code', async () => {
  const session = await consoleModule('editor/session.js');
  const loader = await consoleModule('editor/loader.js');
  const vm = await import('node:vm');
  const G = c.G, N = c.N;
  const original = G[N.mapText];
  const level = (on) => { G.stage.currentFrameLabel = on ? 'gaming' : 'menu'; c.frame(); };
  const quiet = (line) => c.run(line).filter((l) => !l.startsWith('Note:'));
  // Like the game's: tags and attribute names through its string table, the light loop
  // counting with a script-level "let", the lightmap drawn by a function of its own.
  G.$tagBox = 'box'; G.$tagLamp = 'lamp'; G.$strX = '#x';
  vm.runInThisContext('let $lampLoop = 0;');
  const frame2 = `
for(var $el of $doc.children())
{
if(a==$tagBox)
{
$wallsBuilt++;
}
if(a==$tagLamp)
{
$lampX[$lampN]=parseFloat(b[$strX]);
$lampY[$lampN]=parseFloat(b["#y"]);
$lampP[$lampN]=Math.min(parseFloat(b["#power"]),100);
$lampS[$lampN]=2;
if(b["#flare"]=="true"||parseFloat(b["#flare"])>0)
{
}
else
$lampS[$lampN]=-1;
if($lampS[$lampN]==2||$inBg($lampX[$lampN],$lampY[$lampN]))
{
$lampN++;
}
}
}
for(i2=0;i2<$lampN;i2++)
{
if($lampS[i2]===2)
{
$flares[$flareN]=graphics_3d_front.addChildAt(new lens_flare,graphics_3d_front.numChildren);
$flares[$flareN]["x"]=$lampX[i2];
$flares[$flareN]["y"]=$lampY[i2];
$flareN++;
}
}
for($lampLoop=0;$lampLoop<$lampN;$lampLoop++)
{
var g={ createRadialGradientAndBeginFill() {} };
g.createRadialGradientAndBeginFill($lampX[$lampLoop],$lampY[$lampLoop]);
$shapes[$lampLoop]={ x: $lampX[$lampLoop], power: $lampP[$lampLoop] };
}
function $drawLights(full)
{
$drawn=[];
for(var k=0;k<$lampN;k++)
if($lampS[k]!=0)
{
$lightmap.drawWithQuality($shapes[k]);
$drawn.push($shapes[k]);
}
}
`;
  // Slot 0: a light of the game's own (along a wall); slot 1: the map's lamp.
  Object.assign(G, {
    $wallsBuilt: 0, $lampX: [7, 100], $lampY: [7, 50], $lampP: [0.45, 0.4], $lampS: [-1, 2], $lampN: 2,
    $shapes: ['fill', 'lamp shape'], $flares: [{ x: 100, y: 50, visible: true, scaleX: 1, scaleY: 1 }], $flareN: 1, $drawn: [],
    $inBg: (x) => x < 200, $lightmap: { drawWithQuality() {} }, g: 'the game\'s g',
    graphics_3d_front: { numChildren: 0, addChildAt(o) { this.numChildren++; return o; } },
    lens_flare: class { constructor() { Object.assign(this, { visible: true, scaleX: 1, scaleY: 1 }); } },
  });
  G.$drawLights = vm.runInThisContext('(function $drawLights(){ $drawn=[]; for(var k=0;k<$lampN;k++) if($lampS[k]!=0) $drawn.push($shapes[k]); })');
  await loader.readLoader(async () => ({ ok: true, status: 200, text: async () => frame2 }));
  assert.ok(loader.loaderReady(), loader.loaderProblem());
  try {
    G[N.mapText] = '<lamp uid="#l1" x="100" y="50" power="0.4" flare="1" />';
    c.run('editor on');
    level(false); level(true);
    const doc = session.editorDoc();
    session.select(doc.byUid('#l1'));
    // Moved: its own slot (1, not its place in the map), the old flare out, a new one, its light drawn.
    assert.deepEqual(quiet('editor set x 120'), ['#l1: x = "120", live now']);
    assert.deepEqual([G.$lampX, G.$lampN, G.$flares[0].visible], [[7, 120], 2, false]);
    assert.deepEqual([G.$flares[1].x, G.$flares[1].visible], [120, true]);
    assert.deepEqual(G.$shapes[1], { x: 120, power: 0.4 });
    assert.deepEqual(G.$drawn, ['fill', G.$shapes[1]], 'the lightmap drawn again');
    assert.equal(vm.runInThisContext('$lampLoop'), 0, 'the game\'s loop variable as it was');
    assert.equal(G.g, 'the game\'s g');
    // No flare: kept inside a background.
    quiet('editor set flare 0');
    assert.deepEqual([G.$lampS[1], G.$flares[1].visible], [-1, false]);
    // Out of every background without a flare: the loader does not keep it, it is put out.
    quiet('editor set x 300');
    assert.deepEqual([G.$lampS[1], G.$lampN], [0, 2]);
    assert.deepEqual(G.$drawn, ['fill']);
    assert.deepEqual(G.$shapes[1], { x: 300, power: 0 }, 'a light of nothing, if a new round lights it again');
    quiet('editor set x 150');
    assert.deepEqual([G.$lampX[1], G.$lampS[1], G.$lampN], [150, -1, 2], 'back in its slot');
    // Added: a new slot at the end, with its light and flare.
    c.run('editor add lamp 50 60');
    const added = session.selected();
    assert.deepEqual([G.$lampN, G.$lampX[2], G.$lampS[2], G.$shapes[2].x, G.$flares.at(-1).x], [3, 50, 2, 50, 50]);
    assert.equal(session.pendingCount(), 0, 'in the running level');
    c.press('Delete');
    assert.deepEqual([G.$lampS[2], G.$flares.at(-1).visible], [0, false]);
    c.run('editor undo');
    assert.equal(G.$lampS[2], 2, 'lit again');
    assert.equal(added.live.index, 2);
  } finally {
    session.setEditor(false); session.forgetDocument();
    G[N.mapText] = original;
    for (const k of ['$tagBox', '$tagLamp', '$strX', '$wallsBuilt', '$lampX', '$lampY', '$lampP', '$lampS', '$lampN', '$shapes',
      '$flares', '$flareN', '$drawn', '$inBg', '$lightmap', 'g', 'graphics_3d_front', 'lens_flare', '$drawLights']) delete G[k];
  }
});

test('editor: an engine mark\'s parameter offers what its mark takes, as the editor\'s mark pairs say', async () => {
  const { paramInfo, dropdownItems } = await consoleModule('editor/params.js');
  const table = globalThis.PB2_OPCODES;
  const rows = [
    { name: 'mark', kind: 'engine_mark', title: 'Modificator', desc: 'Game modificator', cls: 'inf' },
    { name: 'forteam', kind: 'nochange', title: 'Parameter', desc: 'Modificator parameter', cls: 'inf' },
  ];
  table.params.push(...rows);
  Object.assign(table.markPairs, { sky: 'sky_model', he_nades_count: 'value>=0+round1' });
  table.values.sky_model = { 1: 'Yellow, dark', 5: 'Space' };
  try {
    assert.equal(paramInfo('inf', 'forteam', { mark: 'sky' }).kind, 'sky_model');
    assert.deepEqual(dropdownItems(paramInfo('inf', 'forteam', { mark: 'sky' }).kind).map((i) => [i.value, i.label, i.picture.src]),
      [['1', 'Yellow, dark', '/level_editor/pic.php?m=1&c=6'], ['5', 'Space', '/level_editor/pic.php?m=5&c=6']]);
    assert.equal(paramInfo('inf', 'forteam', { mark: 'he_nades_count' }).kind, 'value>=0+round1');
    assert.equal(paramInfo('inf', 'forteam', { mark: 'casual' }).kind, 'nochange', 'a mark the table leaves out: free text');
    assert.equal(paramInfo('inf', 'forteam', {}).kind, 'nochange', 'the default mark (hero1_guns)');
    assert.equal(paramInfo('inf', 'mark', { mark: 'sky' }).kind, 'engine_mark');
  } finally {
    table.params.splice(table.params.length - rows.length, rows.length);
    for (const k of Object.keys(table.markPairs)) delete table.markPairs[k];
    delete table.values.sky_model;
  }
});

test('editor: movables and water take every parameter in the running level, with the loader\'s later steps', async () => {
  const session = await consoleModule('editor/session.js');
  const loader = await consoleModule('editor/loader.js');
  const vm = await import('node:vm');
  const G = c.G, N = c.N;
  const original = G[N.mapText];
  const quiet = (line) => c.run(line).filter((l) => !l.startsWith('Note:'));
  const level = (on) => { G.stage.currentFrameLabel = on ? 'gaming' : 'menu'; c.frame(); };
  // A frame2.js shaped like the game's: branches that make movables, regions and water,
  // then the later steps over all of them, each loop calling the loader's watchdog (which
  // throws once the level is built).
  G.$tagBox = 'box'; G.$tagDoor = 'door'; G.$tagRegion = 'region'; G.$tagWater = 'water';
  vm.runInThisContext('let $watch = () => { throw new Error("Map construction took longer than 15 seconds"); };');
  // Its counters are "$" names, like the game's; the console reads them by its own names.
  const [doors, doorCount, waters, waterCount] = [N.doors, '$doorN', N.waters, '$waterN'];
  for (const [mine, theirs] of [[N.doorCount, '$doorN'], [N.waterCount, '$waterN'], [N.regionCount, '$regionN']]) {
    Object.defineProperty(G, mine, { get: () => G[theirs], set: (v) => { G[theirs] = v; }, configurable: true });
  }
  const [wx, wy, ww, wh, wd] = [N.waterX, N.waterY, N.waterW, N.waterH, N.waterDamage];
  const frame2 = `
let $watch=()=>
{
let t=Date.now();
};
for(var $el of $doc.children())
{
if(a==$tagBox)
{
$wallsBuilt++;
}
if(a==$tagWater)
{
${waters}[${waterCount}]=new water();
if(b["#attach"]!="-1"&&b["#attach"]!=""&&b["#attach"]!=undefined)
attachments.push({parent:b["#attach"],id:${waterCount},child:${waters}[${waterCount}],type:5});
${wx}[${waterCount}]=parseFloat(b["#x"]);
${wy}[${waterCount}]=parseFloat(b["#y"]);
${ww}[${waterCount}]=parseFloat(b["#w"]);
${wh}[${waterCount}]=parseFloat(b["#h"]);
${wd}[${waterCount}]=parseFloat(b["#damage"]);
$friction[${waterCount}]=(b["#friction"]!="0"&&b["#friction"]!="false");
${waterCount}++;
}
if(a==$tagDoor)
{
mc=graphics_3d.addChildAt(new door,graphics_3d.numChildren);
mc.visible=false;
if(b["#vis"]=="true")
mc.$vis=true;
else
mc.$vis=false;
mc.$startX=mc["x"]=parseFloat(b["#x"]);
mc.$startY=mc["y"]=parseFloat(b["#y"]);
mc.scaleX=parseFloat(b["#w"])/100;
mc.scaleY=parseFloat(b["#h"])/100;
${doors}[${doorCount}]=mc;
mc.w=parseFloat(b["#w"]);
mc.h=parseFloat(b["#h"]);
mc.$moving=(b["#moving"]=="true");
mc.$startTarX=mc["tarx"]=parseFloat(b["#tarx"]);
mc.$startTarY=mc["tary"]=parseFloat(b["#tary"]);
mc.$startSpeed=mc.$speed=parseFloat(b["#maxspeed"]);
mc.$sound=!(b["#mute"]==="true"||b["#mute"]==="1");
if(b["#attach"]!=="-1"&&b["#attach"]!==""&&b["#attach"]!==undefined)
attachments.push({parent:b["#attach"],child:mc,type:0});
${doorCount}++;
}
if(a==$tagRegion)
{
${N.regions}[$regionN]=new Object();
${N.regions}[$regionN]["x"]=parseFloat(b["#x"]);
${N.regions}[$regionN]["y"]=parseFloat(b["#y"]);
${N.regions}[$regionN].w=parseFloat(b["#w"]);
${N.regions}[$regionN].h=parseFloat(b["#h"]);
if(b["#attach"]!=="-1"&&b["#attach"]!==""&&b["#attach"]!==undefined)
attachments.push({parent:b["#attach"],child:${N.regions}[$regionN],type:4});
$regionN++;
}
}
for(var i=0;i<attachments.length;i++)
{
$watch();
attachments[i].parent=${doors}[$doorOf(attachments[i].parent)];
if(attachments[i]["type"]==5)
{
attachments[i].dx=${wx}[attachments[i].id]-attachments[i].parent["x"];
attachments[i].dy=${wy}[attachments[i].id]-attachments[i].parent["y"];
}
else
{
attachments[i].dx=attachments[i].child["x"]-attachments[i].parent["x"];
attachments[i].dy=attachments[i].child["y"]-attachments[i].parent["y"];
}
}
for(i=0;i<${waterCount};i++)
{
$watch();
if($friction[i])
{
$shown=graphics_3d_front.addChildAt(${waters}[i],0);
$shown["x"]=${wx}[i];
$shown["y"]=${wy}[i];
$shown.scaleX=${ww}[i]/100;
$shown.scaleY=${wh}[i]/100;
if(${wd}[i]>0)
$shown.gotoAndStop(1);
else
$shown.gotoAndStop(2);
}
${wx}[i]-=10;
${ww}[i]+=20;
${wh}[i]+=10;
}
for(i=0;i<${doorCount};i++)
{
if(${doors}[i].$vis)
{
mc=game.addChildAt(new veh_hh,game.numChildren);
mc["x"]=${doors}[i]["x"];
mc.$edgeOf=i;
mc=game.addChildAt(new veh_hh,game.numChildren);
mc["x"]=${doors}[i]["x"]+${doors}[i].w;
mc.$edgeOf=i;
}
}
for(i=0;i<${doorCount};i++)
if(${doors}[i].$vis)
{
$watch();
$tex=graphics_3d.addChildAt(new texture_front0,graphics_3d.numChildren);
$tex["x"]=${doors}[i]["x"];
$tex.scaleX=${doors}[i].scaleX;
$tex.scaleY=${doors}[i].scaleY;
$tex["y"]=${doors}[i]["y"];
${N.textureFollows}($tex,i);
}
function ${N.textureFollows}(clip,$door)
{
$tieN=$tieClips.length;
$tieClips[$tieN]=clip;
$tieDoors[$tieN]=$door;
}
function $moveTied(i,$speed,$interp=0)
{
for(var $k=0;$k<attachments.length;$k++)
if(attachments[$k].parent===${doors}[i])
{
attachments[$k].child["x"]=${doors}[i]["x"]+attachments[$k].dx;
attachments[$k].child["y"]=${doors}[i]["y"]+attachments[$k].dy;
}
}
`;
  const layer = () => ({ children: [], get numChildren() { return this.children.length; },
    addChildAt(o, at) { if (o.parent) o.parent.removeChild(o); this.children.splice(at, 0, o); o.parent = this; return o; },
    removeChild(o) { this.children.splice(this.children.indexOf(o), 1); o.parent = null; },
    clearMCInterpolationData() {} });
  const saved = { game: G.game, graphics_3d: G.graphics_3d, graphics_3d_front: G.graphics_3d_front, regions: G[N.regions], regionCount: G[N.regionCount] };
  const world = Object.assign(layer(), { x: saved.game.x, y: saved.game.y, scaleX: saved.game.scaleX, scaleY: saved.game.scaleY, parent: saved.game.parent });
  Object.assign(G, {
    graphics_3d: layer(), graphics_3d_front: layer(), game: world, attachments: [], $tieClips: [], $tieDoors: [], $friction: [], $wallsBuilt: 0,
    $regionN: 0, $doorOf: (uid) => G[doors].findIndex((d) => d.uid === uid),
    door: class { constructor() { this.uid = null; } }, water: class { gotoAndStop(f) { this.frame = f; } }, veh_hh: class {}, texture_front0: class {},
    [N.textureFollows]: (clip, door) => { G.$tieClips.push(clip); G.$tieDoors.push(door); },
    $moveTied: (i) => { for (const a of G.attachments) if (a.parent === G[doors][i]) { a.child.x = G[doors][i].x + a.dx; a.child.y = G[doors][i].y + a.dy; } },
    [doors]: [], $doorN: 0, [waters]: [], $waterN: 0, [wx]: [], [wy]: [], [ww]: [], [wh]: [], [wd]: [], [N.regions]: [],
    [N.displayInit]: () => {},
  });
  await loader.readLoader(async () => ({ ok: true, status: 200, text: async () => frame2 }));
  assert.ok(loader.loaderReady(), loader.loaderProblem());
  // Uids as the game's own uid table would resolve them (the fake keeps it on the movable).
  const named = (uid) => { const d = G[doors][G[doors].length - 1]; d.uid = uid; };
  try {
    G[N.mapText] = '<box x="0" y="0" w="10" h="10" m="0" />';
    c.run('editor on');
    level(false); level(true);
    // Added: the movable, its texture (tied to it) and its two edges.
    assert.deepEqual(quiet('editor add door 500 0 40 10'), ['Added #door*1 at 500, 0 (40 x 10); in the running level']);
    const lift = session.selected();
    named(lift.attrs.uid);
    const tex = G.$tieClips[0];
    assert.deepEqual([G[doorCount], G.graphics_3d.children.includes(tex), G.$tieDoors[0], tex.x, tex.scaleX], [1, true, 0, 500, 0.4]);
    assert.equal(G.game.children.length, 2, 'two edges');
    // A region attached to it: tied as the loader ties it.
    c.run('editor add region 510 -20 20 20');
    const rider = session.selected();
    assert.deepEqual(quiet(`editor set attach ${lift.attrs.uid}`), [`${rider.attrs.uid}: attach = "${lift.attrs.uid}", live now`]);
    assert.equal(G.attachments.length, 1);
    assert.deepEqual([G.attachments[0].parent, G.attachments[0].dx, G.attachments[0].dy], [G[doors][0], 10, -20]);
    // The movable moved: its start copy for a new round, its texture, what rides on it.
    session.select(lift);
    assert.deepEqual(quiet('editor set x 600'), [`${lift.attrs.uid}: x = "600", live now`]);
    assert.deepEqual([G[doors][0].x, G[doors][0].$startX, tex.x, G[N.regions][0].x], [600, 600, 600, 610]);
    quiet('editor set tary -50');
    assert.deepEqual([G[doors][0].tary, G[doors][0].$startTarY], [-50, -50]);
    // Hidden: built again, its texture taken off, the rider tied to the new one.
    const before = G[doors][0];
    assert.deepEqual(quiet('editor set vis false'), [`${lift.attrs.uid}: vis = "false", live now`]);
    named(lift.attrs.uid);
    assert.notEqual(G[doors][0], before);
    assert.ok(!G.graphics_3d.children.includes(tex), 'no texture');
    assert.equal(G.attachments[0].parent, G[doors][0], 'the rider on the new one');
    // Shown again: the same texture back, no second pair of edges.
    quiet('editor set vis true');
    named(lift.attrs.uid);
    assert.deepEqual([G.graphics_3d.children.includes(tex), tex.x, G.game.children.length, G.$tieClips.length], [true, 600, 2, 1]);
    for (const [attr, v, field, want] of [['maxspeed', '20', '$speed', 20], ['moving', 'true', '$moving', true], ['mute', 'true', '$sound', false]]) {
      assert.deepEqual(quiet(`editor set ${attr} ${v}`), [`${lift.attrs.uid}: ${attr} = "${v}", live now`]);
      named(lift.attrs.uid);
      assert.equal(G[doors][0][field], want, attr);
    }
    assert.equal(G[doors][0].$startSpeed, 20);

    // Water: shown as water, its area widened, as the loader does once the map is read.
    c.run('editor add water 800 0 100 50');
    const pool = session.selected();
    const first = G[waters][0];
    assert.deepEqual([G.graphics_3d_front.children[0], first.frame, G[wx][0], G[ww][0], G[wh][0]], [first, 2, 790, 120, 60]);
    // Acid: built again and shown as acid, the area widened once.
    assert.deepEqual(quiet('editor set damage 5'), [`${pool.attrs.uid}: damage = "5", live now`]);
    assert.ok(!G.graphics_3d_front.children.includes(first), 'the old one off the screen');
    assert.deepEqual([G[waters][0].frame, G[wd][0], G[wx][0], G[ww][0], G[waterCount]], [1, 5, 790, 120, 1]);
    // No friction: not shown.
    quiet('editor set friction false');
    assert.deepEqual(G.graphics_3d_front.children, []);
    // Attached to the movable: tied by its index.
    quiet(`editor set attach ${lift.attrs.uid}`);
    const tie = G.attachments.find((a) => a.type === 5);
    assert.deepEqual([tie.id, tie.parent, tie.dx], [0, G[doors][0], 800 - 600]);
    assert.equal(session.pendingCount(), 0, 'all in the running level');
  } finally {
    session.setEditor(false); session.forgetDocument();
    G[N.mapText] = original;
    Object.assign(G, { game: saved.game, graphics_3d: saved.graphics_3d, graphics_3d_front: saved.graphics_3d_front, [N.regions]: saved.regions });
    for (const k of ['$tagBox', '$tagDoor', '$tagRegion', '$tagWater', 'attachments', '$tieClips', '$tieDoors', '$friction', '$wallsBuilt', '$regionN',
      '$doorOf', 'door', 'water', 'veh_hh', 'texture_front0', '$moveTied', '$shown', '$tex', '$tieN', '$k', '$doorN', '$waterN']) delete G[k];
    for (const k of ['doors', 'doorCount', 'waters', 'waterCount', 'waterX', 'waterY', 'waterW', 'waterH', 'waterDamage', 'regionCount', 'textureFollows']) delete G[N[k]];
    G[N.regionCount] = saved.regionCount;
  }
});

test('editor: every parameter the game reads is in the params panel, and every one says how it reaches a running level', async () => {
  const { paramsOf } = await consoleModule('editor/params.js');
  const { KIND_TAGS } = await consoleModule('editor/kinds.js');
  const { liveSupport } = await consoleModule('editor/apply.js');
  // What the map loader reads of each kind (frame2.js: b["#..."] in each kind's branch).
  const GAME_READS = {
    box: 'x y w h m', image: 'id width height', bg: 'x y w h f c u v a m s', pushf: 'x y w h tox toy stab damage uid attach',
    water: 'attach x y w h damage friction', door: 'vis x y w h moving tarx tary maxspeed uid mute attach',
    region: 'x y w h uses_timer use_target use_on uid attach', trigger: 'execute enabled maxcalls uid', timer: 'enabled maxcalls target delay uid',
    barrel: 'model x y tox toy uid', vehicle: 'model x y tox toy uid side hpp', decor: 'model f u v x y r sx sy uid attach text',
    gun: 'model command upg uid x y', song: 'uid url volume loop callback', inf: 'mark forteam x y', lamp: 'x y power flare uid',
    player: 'x y uid hea hmax tox toy ondeath team botaction side incar char', enemy: 'x y uid hea hmax tox toy ondeath team botaction side incar char',
  };
  assert.deepEqual(Object.keys(GAME_READS).sort(), [...KIND_TAGS].sort(), 'every kind the game reads, and no other');
  for (const tag of KIND_TAGS) {
    const shown = paramsOf(tag);
    for (const attr of GAME_READS[tag].split(' ')) assert.ok(shown.includes(attr), `${tag} ${attr}: not in the panel`);
    for (const attr of shown) {
      const how = liveSupport(tag, attr);
      assert.ok(how && how !== 'the running level cannot take it', `${tag} ${attr}: no way into a running level, and no reason`);
    }
  }
});

test('editor: a wall\'s grab points go with it, where there is room beside its corners, as the loader gives them', async () => {
  const session = await consoleModule('editor/session.js');
  const loader = await consoleModule('editor/loader.js');
  const G = c.G, N = c.N;
  const original = G[N.mapText];
  const quiet = (line) => c.run(line).filter((l) => !l.startsWith('Note:'));
  const level = (on) => { G.stage.currentFrameLabel = on ? 'gaming' : 'menu'; c.frame(); };
  G.$tagBox = 'box';
  // The loader's loop over the walls: a grab point (veh_hh, made a vehicle of model 6) at
  // each top corner the game's line test finds room beside.
  const frame2 = `
for(var $el of $doc.children())
{
if(a==$tagBox)
{
$wallsBuilt++;
}
}
for(i=0;i<${N.wallCount};i++)
{
$HОpcl=75;
if($clear(${N.wallX}[i]-15,${N.wallY}[i]-30,${N.wallX}[i]-15,${N.wallY}[i]+$HОpcl))
if($clear(${N.wallX}[i]+5,${N.wallY}[i]-5,${N.wallX}[i]+5,${N.wallY}[i]-50))
{
mc=game.addChildAt(new veh_hh,game.numChildren);
n=6;
mc["x"]=parseFloat(${N.wallX}[i]);
mc["y"]=parseFloat(${N.wallY}[i]);
$makeVehicle(mc,n,1);
}
}
`;
  const layer = () => ({ children: [], get numChildren() { return this.children.length; },
    addChildAt(o, at) { this.children.splice(at, 0, o); o.parent = this; return o; }, removeChild(o) { this.children.splice(this.children.indexOf(o), 1); } });
  const saved = { game: G.game, graphics_3d: G.graphics_3d };
  const world = Object.assign(layer(), { x: saved.game.x, y: saved.game.y, scaleX: saved.game.scaleX, scaleY: saved.game.scaleY, parent: saved.game.parent });
  const made = [];
  Object.assign(G, {
    game: world, graphics_3d: layer(), $wallsBuilt: 0, veh_hh: class {},
    // No room at x >= 900 (another wall there).
    $clear: (x1, y1, x2) => x1 < 900 && x2 < 900,
    $makeVehicle: (mc, model, side) => { Object.assign(mc, { model, side, io: true }); made.push(mc); },
    [N.displayInit]: () => {},
    [N.wallX]: [100], [N.wallY]: [100], [N.wallW]: [200], [N.wallH]: [20], [N.wallCount]: 1, [N.wallMaterial]: ['0'],
    [N.gridCell]: 100, [N.gridMinX]: -200, [N.gridMinY]: -200, [N.gridCols]: 14, [N.gridRows]: 6,
  });
  G[N.grid] = Array.from({ length: 14 }, () => Array.from({ length: 6 }, () => []));
  G[N.gridAddWall] = () => {};
  await loader.readLoader(async () => ({ ok: true, status: 200, text: async () => frame2 }));
  // The level as loaded: both corners of the wall have one.
  const left = Object.assign(world.addChildAt(new G.veh_hh(), 0), { x: 100, y: 100, io: true, side: 1 });
  const right = Object.assign(world.addChildAt(new G.veh_hh(), 1), { x: 300, y: 100, io: true, side: -1 });
  const at = (h) => (h.io ? [h.x, h.y] : 'out');
  try {
    G[N.mapText] = '<box x="100" y="100" w="200" h="20" m="0" />';
    c.run('editor on');
    level(false); level(true);
    session.select(session.editorDoc().byTag('box')[0]);
    // Moved: the same two go along.
    assert.deepEqual(quiet('editor set x 400'), ['wall #0: x = "400", live now']);
    assert.deepEqual([at(left), at(right), made.length], [[400, 100], [600, 100], 0]);
    quiet('editor set y 150');
    assert.deepEqual([at(left), at(right)], [[400, 150], [600, 150]]);
    // Its right corner against another wall: no room, that one is taken out.
    quiet('editor set x 750');
    assert.deepEqual([at(left), at(right)], [[750, 150], 'out']);
    // Room again: a new one, made as the loader makes it.
    quiet('editor set x 400');
    assert.equal(made.length, 1);
    assert.deepEqual([made[0].x, made[0].y, made[0].model, made[0].side], [600, 150, 6, -1]);
    // Deleted: both out of play.
    c.press('Delete');
    assert.deepEqual([at(left), at(made[0])], ['out', 'out']);
    c.run('editor undo');
    // Added: one at each corner with room.
    assert.match(quiet('editor add wall 0 0 100 20')[0], /; in the running level$/);
    assert.deepEqual(made.slice(1).map((h) => [h.x, h.y, h.side]), [[0, 0, 1], [100, 0, -1]]);
  } finally {
    session.setEditor(false); session.forgetDocument();
    G[N.mapText] = original;
    Object.assign(G, saved);
    for (const k of ['$tagBox', '$wallsBuilt', 'veh_hh', '$clear', '$makeVehicle', '$HОpcl']) delete G[k];
  }
});

test('zoom: any amount once, or locked so the map cannot change it', () => {
  const { G, N } = c;
  const run = (line) => c.run(line).filter((l) => !l.startsWith('Note:'));
  const was = G[N.zoom];
  G[N.zoom] = 1;
  try {
    assert.deepEqual(run('zoom 35'), ['Zoom 35%']);
    assert.equal(G[N.zoom], 0.35);
    G[N.zoom] = 2; // a map trigger
    c.frame();
    assert.equal(G[N.zoom], 2, 'not held without --lock');
    assert.match(run('zoom 50 --lock')[0], /^Zoom 50%, locked/);
    G[N.zoom] = 0.75; // getting into a vehicle
    c.frame();
    assert.equal(G[N.zoom], 0.5, 'put back');
    assert.deepEqual(run('zoom'), ['Zoom: 50%, locked at 50%']);
    assert.deepEqual(c.run('list zoom'), ['[zoom]', '  locked at 50%  ("zoom --unlock" lets go)']);
    assert.deepEqual(run('zoom 80'), ['Zoom 80% (unlocked)']);
    assert.deepEqual(c.run('list zoom'), ['[zoom]', '  80%  (once: the map can change it)']);
    G[N.zoom] = 1;
    c.frame();
    assert.equal(G[N.zoom], 1);
    run('zoom 60 --lock');
    assert.match(run('zoom --unlock')[0], /^Zoom unlocked/);
    G[N.zoom] = 1;
    c.frame();
    assert.equal(G[N.zoom], 1);
    assert.deepEqual(run('zoom default'), ['Zoom 100%']);
    assert.deepEqual(c.run('list zoom'), ['[zoom] nothing']);
    for (const bad of ['zoom 0', 'zoom 2000', 'zoom abc', 'zoom --lock', 'zoom 50 --lock --unlock']) {
      assert.match(run(bad).join(' '), /usage|do not go together/, bad);
    }
  } finally {
    run('zoom --unlock');
    G[N.zoom] = was;
  }
});

test('editor reset: every edit undone in the running level and forgotten, nothing put in again', async () => {
  const session = await consoleModule('editor/session.js');
  const { G, N } = c;
  const quiet = (line) => c.run(line).filter((l) => !l.startsWith('Note:'));
  const level = (on) => { G.stage.currentFrameLabel = on ? 'gaming' : 'menu'; c.frame(); };
  const regions = G[N.regions];
  const count = G[N.regionCount];
  G[N.regionCount] = regions.length;
  try {
    level(true);
    c.run('editor on');
    const doc = session.editorDoc();
    const red = doc.byUid('#red_use');
    const i = red.live.index;
    const y0 = regions[i].y;
    session.select(red);
    quiet('editor set y 30');
    quiet('editor set x 77');
    assert.deepEqual([regions[i].y, regions[i].x], [30, 77]);
    c.run('editor off');
    assert.deepEqual(c.run('list editor'), ['[editor: 1 changed]',
      '  in the running level; put in again when the level starts over on this map', '  ("editor reset" undoes and forgets them)']);
    assert.match(quiet('editor reset')[0], /^Reset: 2 edits undone in the running level, every edit forgotten/);
    assert.equal(regions[i].y, y0, 'the map\'s again');
    assert.deepEqual(c.run('list editor'), ['[editor] nothing']);
    // On again: the map as the game has it, no history, nothing to put in.
    c.run('editor on');
    assert.notEqual(session.editorDoc(), doc);
    assert.equal(session.editorDoc().byUid('#red_use').attrs.y, String(y0));
    assert.equal(quiet('editor undo')[0], 'Nothing to undo');
    // An edit, then the level starts over with the editor off: the level is the map's
    // own, so a reset only forgets it.
    session.select(session.editorDoc().byUid('#red_use'));
    quiet('editor set y 40');
    c.run('editor off');
    regions[i].y = y0; // the game builds the level again from the map
    level(false); level(true);
    assert.deepEqual(quiet('editor reset'), ['Reset: every edit forgotten; nothing is put in again when the level starts over']);
    c.run('editor on');
    assert.equal(regions[i].y, y0, 'not put in again');
  } finally {
    session.setEditor(false); session.forgetDocument();
    G[N.regionCount] = count;
  }
});

// ---------------------------------------------------------------------------
// Network recorder (net/recorder.js) and "netlog"
// ---------------------------------------------------------------------------
// The game's number digits: characters 1-126 without "-", "~" and the two separators.
const NET_DIGITS = [...Array(126)].map((_, i) => String.fromCharCode(i + 1)).filter((ch) => !['-', '~', '\x01', '\x02'].includes(ch)).join('');
const encNum = (n) => { let s = ''; do { s = NET_DIGITS[n % NET_DIGITS.length] + s; n = Math.floor(n / NET_DIGITS.length); } while (n > 0); return s; };
const netMsg = (type, ...parts) => [encNum(type), ...parts].join('\x02');
const netPacket = (ack, state, rel = []) => [String(ack), state, ...rel.flatMap(([u, d]) => [String(u), d])].join('\x01');

// A connection like scripts/connection.js makes: a receive method on its class, a
// socket.io socket with volatile emit.
function fakeConnection(N) {
  class Conn { [N.connRecv](text) { this.got.push(text); } }
  const c = new Conn();
  c.got = [];
  c.ping = 1000;
  c.socket = {
    connected: false, flags: {}, sent: [], io: { engine: { transport: { writable: true, name: 'websocket' } } },
    get volatile() { this.flags.volatile = true; return this; },
    emit(event, data) { if (!(this.flags.volatile && !this.io.engine.transport.writable)) this.sent.push(data); this.flags = {}; },
  };
  return c;
}

test('the network recorder logs messages readably and every kind of packet loss, not the normal repeats', async () => {
  const { G, N } = c;
  const rec = await consoleModule('net/recorder.js');
  const net = G[N.net];
  net[N.netDigits] = NET_DIGITS;
  net[N.netTypeNames] = { 0: 'RELIABLE_RESPONSE', 5: 'RELIABLE_CHAT' };
  const conn = fakeConnection(N);
  const emit = conn.socket.emit;
  let t = Date.now();
  rec.setClock(() => t);
  net.connections = [];
  rec.netTick(); // the page line, first time
  net.connections = [conn];
  net[N.lobbyConn] = conn;
  const since = rec.netlog.lines().length;
  const fresh = () => rec.netlog.lines().slice(since).map((l) => l.slice(14)); // without the time
  try {
    rec.netTick();
    conn.socket.connected = true;
    conn.ping = 100;
    rec.netTick(t += 50);
    // Sent: a chat message with text and an encoded number, then the same message in the
    // next packet (the game repeats it until its ack: no line), then a packet the busy
    // socket drops.
    const chat = netPacket(-1, '', [[0, netMsg(5, 'hello | world', encNum(7), 'plain text')]]);
    conn.socket.volatile.emit('m', chat);
    t += 16;
    conn.socket.volatile.emit('m', chat);
    conn.socket.io.engine.transport.writable = false;
    conn.socket.volatile.emit('m', netPacket(-1, netMsg(1, 'x'), []));
    conn.socket.io.engine.transport.writable = true;
    // #0 is acknowledged 900 ms after it was sent, with a ping of 100 ms: a slow ack.
    t += 884;
    // Received: #0, then #2 before #1 (a gap), then #1 (late), then #1 again (a repeat: no line).
    conn[N.connRecv](netPacket(0, '', [[0, netMsg(0, encNum(150))], [2, netMsg(5, 'b')]]));
    conn[N.connRecv](netPacket(0, '', [[1, netMsg(5, 'a')]]));
    conn[N.connRecv](netPacket(0, '', [[1, netMsg(5, 'a')]]));
    assert.equal(conn.got.length, 3, 'the game still gets every packet');
    assert.equal(conn.socket.sent.length, 2, 'and the socket still sends');
    // #1 is sent and never acknowledged: "no ack" once, after 2 s.
    conn.socket.volatile.emit('m', netPacket(2, '', [[1, netMsg(5, 'anyone?')]]));
    rec.netTick(t += 1000);
    rec.netTick(t += 1100);
    rec.netTick(t += 500);
    conn[N.connReason] = 'io server disconnect';
    net.connections = [];
    rec.netTick(t += 50);
    const out = fresh();
    const want = [
      /^c\d+ server +--- +CONN +new connection \(socket\.io over websocket\)$/,
      /^c\d+ server +--- +CONN +connected/,
      /^c\d+ server +OUT +REL +#0 CHAT\("hello \| world", 7, "plain text"\)$/,
      /^c\d+ server +OUT +LOSS +dropped: the socket was busy.*0 reliable messages.*its state update is lost\)$/,
      /^c\d+ server +OUT +LOSS +slow ack: #0 CHAT acknowledged after 900 ms, ping 100 ms \(sent 2 times\): packets or acks were lost on the way$/,
      /^c\d+ server +IN +REL +#0 RESPONSE\(150\)$/,
      /^c\d+ server +IN +REL +#2 CHAT\("b"\)$/,
      /^c\d+ server +IN +LOSS +gap: #2 arrived before #1 \(1 missing: lost or out of order\)$/,
      /^c\d+ server +IN +REL +#1 CHAT\("a"\)$/,
      /^c\d+ server +IN +LOSS +late #1 arrived \d+ ms after the gap was seen$/,
      /^c\d+ server +OUT +REL +#1 CHAT\("anyone\?"\)$/,
      /^c\d+ server +--- +STAT +ping 100 ms \| acks in 900 ms \| out 4 packets .* \| in 3 packets .* \| repeated 1 out, 1 in \| loss: 1 slow ack, 1 dropped, 1 gap, 1 late \| 1 waiting for ack$/,
      /^c\d+ server +OUT +LOSS +no ack: #1 CHAT not acknowledged after 2100 ms \(sent 1 time\): nothing is getting through$/,
      /^c\d+ server +--- +CONN +closed: io server disconnect \(the server closed the connection on purpose\) \| after .* \| acks in 900 ms \| loss: 1 slow ack, 1 no ack, 1 dropped, 1 gap, 1 late$/,
    ];
    assert.equal(out.length, want.length, out.join('\n'));
    want.forEach((re, i) => assert.match(out[i], re));
    assert.ok(!Object.hasOwn(conn, N.connRecv) && conn.socket.emit === emit, 'a closed connection is unwrapped');
  } finally {
    rec.setClock(null);
    net.connections = [];
  }
});

test('net_log off unwraps every connection and stops recording; on starts again', async () => {
  const { G, N } = c;
  const rec = await consoleModule('net/recorder.js');
  const net = G[N.net];
  const conn = fakeConnection(N);
  const emit = conn.socket.emit;
  conn.socket.connected = true;
  net.connections = [conn];
  let t = Date.now() + 100000;
  try {
    rec.netTick(t);
    assert.ok(Object.hasOwn(conn, N.connRecv), 'wrapped while on');
    c.run('net_log off');
    rec.netTick(t += 50);
    assert.ok(!Object.hasOwn(conn, N.connRecv) && conn.socket.emit === emit, 'unwrapped when off');
    assert.match(rec.netlog.lines().at(-1), /PAGE +recording off \(net_log off\)$/);
    const n = rec.netlog.lines().length;
    conn[N.connRecv](netPacket(0, '', [[0, netMsg(5, 'x')]]));
    assert.equal(rec.netlog.lines().length, n, 'nothing recorded while off');
    c.run('net_log on');
    rec.netTick(t += 50);
    const back = rec.netlog.lines().slice(n).join('\n');
    assert.match(back, /PAGE +recording on/);
    assert.match(back, /CONN +already connected when recording started/);
    // Recording started mid-stream: the first message seen is not a gap.
    conn[N.connRecv](netPacket(0, '', [[40, netMsg(5, 'y')]]));
    assert.doesNotMatch(rec.netlog.lines().slice(n).join('\n'), /gap/);
  } finally {
    c.run('unset net_log');
    net.connections = [];
    rec.netTick(t + 50);
  }
});

test('netlog: status, the last lines with filters, other instances and on/off', async () => {
  const { G, N } = c;
  const rec = await consoleModule('net/recorder.js');
  const net = G[N.net];
  net[N.netDigits] = NET_DIGITS;
  net[N.netTypeNames] = { 5: 'RELIABLE_CHAT', 9: 'RELIABLE_SHOT' };
  const conn = fakeConnection(N);
  net.connections = [conn];
  net[N.lobbyConn] = conn;
  const realFetch = G.fetch;
  let t = Date.now() + 200000;
  const since = rec.netlog.lines().length;
  const last = () => `last:${rec.netlog.lines().length - since}`; // this test's lines only
  try {
    rec.netTick(t);
    conn.socket.connected = true;
    conn.ping = 45;
    rec.netTick(t += 50);
    conn.socket.volatile.emit('m', netPacket(-1, '', [[0, netMsg(5, 'hello there')], [1, netMsg(9, encNum(3))]]));
    conn[N.connRecv](netPacket(1, '', [[0, netMsg(5, 'hi back')], [2, netMsg(9, encNum(4))]]));

    const st = c.run('netlog');
    assert.match(st[0], /^Network log: on \(net_log\)\. Everything \(every packet and state update\): off \(net_log_all\)\. State updates: counted only \(net_log_state\)\.$/);
    assert.ok(st.some((l) => /^ {2}c\d+ server +connected, ping 45 ms, out 1 packets, in 1 packets \| loss: 1 gap \| 1 missing$/.test(l)), st.join('\n'));

    const chat = c.run(`netlog show type:chat ${last()}`);
    assert.match(chat[0], /^Network log, this page: 2 of the last \d+ lines match\.$/);
    assert.match(chat[1], /OUT +REL +#0 CHAT\("hello there"\)$/);
    assert.match(chat[2], /IN +REL +#0 CHAT\("hi back"\)$/);
    const back = c.run(`net show --in hi ${last()}`);
    assert.equal(back.length, 3, back.join('\n'));
    assert.match(c.run(`netlog show --loss ${last()}`)[1], /LOSS +gap: #2 arrived before #1/);
    assert.match(c.run(`netlog show --out type:shot ${last()}`)[1], / SHOT\(3\)$/);
    assert.match(c.run('netlog show --in --out')[0], /^error: --in and --out do not go together/);
    assert.match(c.run('netlog show nothing-like-this')[1], /Nothing matches/);

    // Other instances: listed by the wrapper, read by name or by their number in the list.
    const asked = [];
    G.fetch = (url) => {
      asked.push(url);
      if (url.includes('netruns')) {
        return Promise.resolve({ ok: true, json: async () => [
          { name: '2026-11-01_05-30-12_local', size: 2048, updated: Date.now(), active: true, mine: true, current: true },
          { name: '2026-11-01_05-31-00_local', size: 4096, updated: Date.now() - 2000, active: true, mine: false, current: false },
        ] });
      }
      return Promise.resolve({ ok: true, text: async () => [
        '05:31:01.000  c1 server     OUT  REL    #0 CHAT("from the other app")',
        '05:31:02.000  c1 server     OUT  LOSS   resend #0 CHAT (try 2, first sent 2001 ms ago, not acknowledged yet)',
      ].join('\n') });
    };
    c.run('netlog runs');
    await new Promise((r) => setImmediate(r));
    const list = c.log.printed.filter((l) => !l.startsWith('> '));
    assert.match(list[0], /^Network logs in netlogs\/, newest first \(2\)/);
    assert.match(list[1], /^ +1 {2}2026-11-01_05-30-12_local +this window +2\.0 KB {2}updated now$/);
    assert.match(list[2], /^ +2 {2}2026-11-01_05-31-00_local +other app, running/);
    c.run('netlog show run:2 --loss');
    await new Promise((r) => setImmediate(r));
    assert.match(asked.at(-1), /netread\?run=2026-11-01_05-31-00_local&lines=1000$/);
    const other = c.log.printed.filter((l) => !l.startsWith('> '));
    assert.match(other[0], /^Network log 2026-11-01_05-31-00_local: 1 of the last 2 lines match\.$/);
    assert.match(other[1], /LOSS +resend #0 CHAT /);
    assert.match(c.run('netlog show run:9')[0], /^error: no run 9/);

    assert.match(c.run('netlog off')[0], /net_log = off/);
    rec.netTick(t += 50);
    assert.match(c.run('netlog')[0], /^Network log: off/);
    c.run('netlog on');
  } finally {
    G.fetch = realFetch;
    c.run('unset net_log');
    net.connections = [];
    rec.netTick(t + 50);
  }
});

test('net_log_all (off by default) adds a PKT line per packet and every state update, decoded', async () => {
  const { G, N } = c;
  const rec = await consoleModule('net/recorder.js');
  const net = G[N.net];
  net[N.netDigits] = NET_DIGITS;
  net[N.netTypeNames] = { 5: 'RELIABLE_CHAT' };
  const conn = fakeConnection(N);
  conn.socket.connected = true;
  net.connections = [conn];
  let t = Date.now() + 300000;
  try {
    rec.netTick(t);
    const since = rec.netlog.lines().length;
    const fresh = () => rec.netlog.lines().slice(since).map((l) => l.slice(14));
    // Off by default: an ack-only packet and a state update leave no line.
    conn[N.connRecv](netPacket(3, netMsg(1, encNum(250), 'x'), []));
    assert.deepEqual(fresh(), []);
    assert.match(c.run('netlog all')[0], /^net_log_all = off$/);
    assert.match(c.run('netlog all on')[0], /net_log_all = on/);
    conn[N.connRecv](netPacket(3, netMsg(1, encNum(250), 'x'), []));
    conn.socket.volatile.emit('m', netPacket(-1, '', [[0, netMsg(5, 'hi')], [1, netMsg(5, 'yo')]]));
    const out = fresh();
    assert.equal(out.length, 5, out.join('\n'));
    assert.match(out[0], /IN +PKT +8 chars \| ack #3 \| state \(3 parts\) 6 chars \| framing 2 chars$/);
    assert.match(out[1], /IN +STATE +\(1, 250, "x"\)$/);
    assert.match(out[2], /OUT +PKT +17 chars \| ack none \| #0 CHAT 4 chars, #1 CHAT 4 chars \| framing 9 chars$/);
    assert.match(out[3], /OUT +REL +#0 CHAT\("hi"\)$/);
    const shown = c.run('netlog show --pkt last:5');
    assert.equal(shown.filter((l) => / PKT /.test(l)).length, 2, shown.join('\n'));
    assert.match(c.run('netlog')[0], /Everything \(every packet and state update\): on \(net_log_all\)\. State updates: written\.$/);
  } finally {
    c.run('unset net_log_all');
    net.connections = [];
    rec.netTick(t + 50);
  }
});

test('the network log decodes a RESPONSE\'s callback ID even when it looks like a letter, and shows JSON as it is', async () => {
  const rec = await consoleModule('net/recorder.js');
  const names = (n) => ({ 0: 'RELIABLE_RESPONSE', 4: 'RELIABLE_GET_MATCH_LIST' })[n];
  assert.equal(encNum(100), 'h', 'the callback counter starts at 100: one letter');
  assert.equal(rec.describeMessage(netMsg(0, encNum(100), 'fail', 'Server: Unknown error [2]'), NET_DIGITS, names).text,
    'RESPONSE(100, "fail", "Server: Unknown error [2]")');
  assert.equal(rec.describeMessage(netMsg(0, encNum(101), 'ok', '[{"uid":1,"map_id":"a-b"}]'), NET_DIGITS, names).text,
    'RESPONSE(101, "ok", [{"uid":1,"map_id":"a-b"}])');
  assert.equal(rec.describeMessage(netMsg(4, 'h'), NET_DIGITS, names).text, 'GET_MATCH_LIST("h")', 'elsewhere a letter stays text');
  assert.equal(rec.describeMessage(netMsg(77), NET_DIGITS, names).text, 'TYPE_77()');
});

test('a RESPONSE says which request it answers, and the PKT line adds up to the packet\'s size', async () => {
  const { G, N } = c;
  const rec = await consoleModule('net/recorder.js');
  const net = G[N.net];
  net[N.netDigits] = NET_DIGITS;
  net[N.netTypeNames] = { 0: 'RELIABLE_RESPONSE', 3: 'RELIABLE_AUTHENTICATE', 26: 'RELIABLE_PING' };
  const conn = fakeConnection(N);
  conn.socket.connected = true;
  net.connections = [conn];
  let t = Date.now() + 400000;
  try {
    rec.netTick(t);
    c.run('net_log_all on');
    const since = rec.netlog.lines().length;
    // The login: the game put callback ID 100 ("h") where its placeholder was.
    conn.socket.volatile.emit('m', netPacket(-1, '', [[0, netMsg(3, '.guest', 'version_h5', encNum(100), 'x')]]));
    // The server's answer, as in a real log: 39 characters.
    const answer = netPacket(0, '', [[0, netMsg(0, encNum(100), 'fail', 'Server: Unknown error [2]')]]);
    assert.equal(answer.length, 39);
    conn[N.connRecv](answer);
    // The server asks (a keep-alive with callback 7); our RESPONSE answers it.
    conn[N.connRecv](netPacket(0, '', [[1, netMsg(26, encNum(7))]]));
    conn.socket.volatile.emit('m', netPacket(1, '', [[1, netMsg(0, encNum(7))]]));
    const out = rec.netlog.lines().slice(since).map((l) => l.slice(14));
    assert.match(out[1], /OUT +REL +#0 AUTHENTICATE\(".guest", "version_h5", "h", "x"\)$/);
    assert.match(out[2], /IN +PKT +39 chars \| ack #0 \| #0 RESPONSE 34 chars \| framing 5 chars$/);
    assert.match(out[3], /IN +REL +#0 RESPONSE\(100, "fail", "Server: Unknown error \[2\]"\) {2}<- answers #0 AUTHENTICATE \(its part 3, "h", was callback ID 100\), \d+ ms later$/);
    assert.match(out[7], /OUT +REL +#1 RESPONSE\(7\) {2}<- answers #1 PING \(its part 1, "\\n", was callback ID 7\), \d+ ms later$/);
  } finally {
    c.run('unset net_log_all');
    net.connections = [];
    rec.netTick(t + 50);
  }
});

// ---------------------------------------------------------------------------
// Ranked match protection (overrides/server-checks.js) and "bypass checks"
// ---------------------------------------------------------------------------
const REFUSED = /^error: refused in a ranked match: .*"bypass checks" turns this protection off \(dangerous\)\.$/;
// The error line of a command's output (a client-only note can come first).
const errorOf = (out) => out.find((l) => l.startsWith('error: ')) || out.join(' | ');
// The match you are in, as MATCH_JOIN_RESPONSE gives it ("approved" is a number).
const inMatch = (t, details) => {
  const net = c.G[c.N.net];
  net.match_details = details;
  t.after(() => { delete net.match_details; });
};
const RANKED = Object.freeze({ approved: 2, ranked: true, map_id: 'zynther-alaska' });

test('only in an approved, ranked match: raising HP and zooming out are refused; the rest still works', (t) => {
  const p = c.player;
  t.after(() => { c.run('reset'); c.run('zoom default'); c.frame(); });
  c.frame();
  const own = p.hmax;
  // Unranked, unapproved, or not in a match: nothing is held back.
  for (const details of [{ approved: 2, ranked: false }, { approved: 0, ranked: false }, null]) {
    c.G[c.N.net].match_details = details;
    assert.ok(c.run('max_hp 500').includes('max_hp = 500'), JSON.stringify(details));
    c.run('unset max_hp');
  }
  inMatch(t, RANKED);
  for (const line of ['max_hp 500', 'hp +100', 'hp +50%', 'hp_bonus 20', 'hp_bonus_pct 10', 'zoom 50', 'zoom 30 --lock', 'game god', 'game god 1', 'game grow', 'game zoom 25']) {
    assert.match(errorOf(c.run(line)), REFUSED, line);
  }
  assert.match(errorOf(c.run('max_hp 500')), /HealthAltering.*ANTICHEAT\.md §14\.4/);
  assert.match(errorOf(c.run('zoom 50')), /announces to the other players.*§14\.6/);
  assert.equal(p.hmax, own, 'nothing changed');
  // Lowering HP, zooming in, other game commands and other keys are not the server's business.
  assert.ok(c.run(`max_hp ${own - 30}`).includes(`max_hp = ${own - 30}`));
  assert.ok(c.run('zoom 150').some((l) => l.startsWith('Zoom 150%')));
  assert.doesNotMatch(c.run('game grow enemies').join(' '), /refused/);
  assert.ok(c.run('speed 2').includes('speed = 2'));
});

test('settings you had are not applied in a ranked match, even with god on, and come back in an unranked one', (t) => {
  const p = c.player;
  inMatch(t, { approved: 2, ranked: false });
  t.after(() => { c.run('reset'); c.run('zoom --unlock'); c.frame(); });
  c.frame();
  const own = p.hmax;
  c.run('max_hp 470; god on; zoom 40 --lock');
  c.frame();
  assert.equal(p.hmax, 470);
  assert.equal(p.hea, 470);
  assert.equal(c.G[c.N.zoom], 0.4);
  c.log.printed.length = 0;
  c.G[c.N.net].match_details = { ...RANKED };
  c.frame();
  assert.equal(p.hmax, own, 'max HP back to the game\'s');
  assert.equal(p.hea, own, 'HP down to it, past god');
  assert.equal(c.G[c.N.zoom], 1, 'zoom back to 100%');
  const notes = c.log.printed.join('\n');
  assert.match(notes, /Ranked match: not applying max_hp: .*HealthAltering.*Your saved values are kept/);
  assert.match(notes, /Ranked match: not applying your zoom 40%/);
  c.log.printed.length = 0;
  c.frame(3);
  assert.deepEqual(c.log.printed, [], 'said once');
  p.hea = 1;
  assert.equal(p.hea, own, 'god itself still works');
  c.G[c.N.net].match_details = { approved: 2, ranked: false };
  c.frame();
  assert.equal(p.hmax, 470, 'unranked again: applied again');
  assert.equal(c.G[c.N.zoom], 0.4);
});

test('bypass checks: a red warning, then only the exact phrase typed on its own line turns the protection off', async (t) => {
  const { run } = await consoleModule('dispatch.js');
  const danger = await consoleModule('state/danger.js');
  inMatch(t, RANKED);
  t.after(() => { danger.protectAgain(); c.run('reset'); c.frame(); });
  assert.match(c.run('bypass')[0], /^Protection: on\. In approved, ranked matches \(you are in one now\)/);

  const warning = c.run('bypass checks');
  assert.match(warning[0], /^WARNING: DANGEROUS\./);
  assert.ok(warning.includes('To go ahead, type exactly: ALLOW DANGEROUS COMMANDS'), warning.join('\n'));
  const NO = 'Not turned off: that was not the phrase. The protection stays on, and the line was not run.';
  // Anything else turns it down and is not run, wrong capitals included.
  assert.deepEqual(c.run('allow dangerous commands'), [NO]);
  assert.match(errorOf(c.run('max_hp 500')), REFUSED);
  c.run('bypass checks');
  assert.deepEqual(c.run('list'), [NO], 'a command is not run either');
  assert.equal(danger.checksBypassed(), false);

  // Not from a bind, a profile or a chain.
  c.log.printed.length = 0;
  run('bypass checks', 'bind f5');
  assert.match(c.log.printed.join('\n'), /error: type "bypass checks" yourself, on a line of its own/);
  assert.match(errorOf(c.run('bypass checks; list')), /error: type "bypass checks" yourself/);
  // A bind pressed while it waits runs as usual, and is not the answer.
  c.run('bypass checks');
  run('ALLOW DANGEROUS COMMANDS', 'bind f5');
  assert.equal(danger.checksBypassed(), false, 'a bind cannot answer');
  assert.match(c.run('ALLOW DANGEROUS COMMANDS')[0], /^Protection OFF/);
  assert.equal(danger.checksBypassed(), true);

  assert.ok(c.run('max_hp 500').includes('max_hp = 500'));
  c.frame();
  assert.equal(c.player.hmax, 500, 'applied in the ranked match now');
  assert.match(c.run('bypass')[0], /^Protection: OFF/);
  assert.ok(c.run('list').some((l) => /ranked match protection: OFF/.test(l)));
  assert.match(c.run('bypass off')[0], /^Protection on again/);
  c.frame();
  assert.notEqual(c.player.hmax, 500, 'held back again');
});

// ---------------------------------------------------------------------------
// State updates by position (net/state.js)
// ---------------------------------------------------------------------------
const encSigned = (n) => (n < 0 ? `-${encNum(-n)}` : encNum(n));
// A player's state as flash.js $ТеeАp builds it (v1769098419): 21 parts.
function playerState({ hp = 100, x = 1264, y = -520, aimX = 212, aimY = -40, respawns = 1, gun = 2, clock = 52310 } = {}) {
  return ['', encSigned(x), encSigned(y), '', '', '', hp === '' ? '' : encNum(hp), encSigned(aimX), encSigned(aimY), '', encNum(gun), '',
    encNum(60), encNum(90), encNum(60), encNum(75), '', '', '', encNum(clock), encNum(respawns)];
}
const LAYOUT = Object.freeze({ x: 1, y: 2, hp: 6, aimX: 7, aimY: 8, headHp: 12, faceHp: 13, killer: 16, clock: 19, respawns: 20, velScale: 5 });

test('a state update is decoded by position, numbers that look like letters included (HP 100 is "h")', async () => {
  const st = await consoleModule('net/state.js');
  const parts = playerState();
  assert.equal(parts[6], 'h', 'HP 100 travels as one letter');
  const line = st.describeState(parts.join('\x02'), NET_DIGITS, 'player', LAYOUT);
  assert.equal(line, 'hp 100 | respawns 1 | aim +212,-40 | pos 1264,-520 | vel 0,0 | body hp: head 60 face 90 arms 60 legs 75 | gun 2 | clock 52.310 s');
  // Dead: part 16 is who killed you.
  const dead = playerState({ hp: 0 });
  dead[16] = encNum(3);
  assert.match(st.describeState(dead.join('\x02'), NET_DIGITS, 'player', LAYOUT), /^hp 0 \| .* \| killed by 3 \|/);
  // The server's snapshot: header (round timer), then each changed player with the server's HP.
  const relayed = playerState({ hp: '' });
  const snap = [encNum(12000), encNum(3), encNum(80), `${encNum(45)}~${encNum(123)}~${encNum(10)}`, encNum(relayed.length), ...relayed,
    encNum(5), encNum(150), `${encNum(60)}~${encNum(100)}~${encNum(0)}`, encNum(0)];
  assert.equal(st.describeState(snap.join('\x02'), NET_DIGITS, 'snapshot', LAYOUT),
    'round timer 12.0 s | #3 hp 80 ping 45 ms [hp - | respawns 1 | aim +212,-40 | pos 1264,-520 | vel 0,0 | body hp: head 60 face 90 arms 60 legs 75 | gun 2 | clock 52.310 s] | #5 hp 150 ping 60 ms');
  // Something else as a snapshot: shown part by part.
  assert.equal(st.describeState(['x', 'y'].join('\x02'), NET_DIGITS, 'snapshot', LAYOUT), '("x", "y")');
});

test('a new game version: the server\'s positions come from the game, the rest is not guessed', async () => {
  const st = await consoleModule('net/state.js');
  // One part added before HP: the game's own positions moved by one.
  const parts = playerState();
  parts.splice(6, 0, encNum(7));
  const moved = { ...LAYOUT, hp: 7, aimX: 8, aimY: 9, headHp: 13, faceHp: 14, killer: 17, clock: 20, respawns: 21 };
  const line = st.describeState(parts.join('\x02'), NET_DIGITS, 'player', moved);
  assert.match(line, /^hp 100 \| respawns 1 \| aim \+212,-40 \| pos 1264,-520 \| head hp 60, face hp 90 \| clock 52\.310 s \| \(22 parts; not this version's layout: only the server's positions are named\), p6 7, /);
  // A name missing from names.js: that value is simply not labelled.
  assert.doesNotMatch(st.describeState(playerState().join('\x02'), NET_DIGITS, 'player', { ...LAYOUT, hp: null }), /hp 100/);
});

test('STATE lines on the main server connection are labelled: your state out, the snapshot in', async (t) => {
  const { G, N } = c;
  const rec = await consoleModule('net/recorder.js');
  const net = G[N.net];
  net[N.netDigits] = NET_DIGITS;
  for (const [k, key] of Object.entries({ x: 'stateX', y: 'stateY', hp: 'stateHp', aimX: 'stateAimX', aimY: 'stateAimY', headHp: 'stateHeadHp', faceHp: 'stateFaceHp', killer: 'stateKiller', clock: 'stateClock', respawns: 'stateRespawns', velScale: 'stateVelScale' })) net[N[key]] = LAYOUT[k];
  const conn = fakeConnection(N);
  conn.socket.connected = true;
  net.connections = [conn];
  net[N.lobbyConn] = conn;
  t.after(() => { c.run('unset net_log_state'); net.connections = []; delete net[N.lobbyConn]; rec.netTick(Date.now() + 999999); });
  rec.netTick(Date.now() + 600000);
  c.run('net_log_state on');
  const since = rec.netlog.lines().length;
  conn.socket.volatile.emit('m', netPacket(-1, playerState({ hp: 150 }).join('\x02')));
  conn[N.connRecv](netPacket(-1, [encNum(0), encNum(0), encNum(150), `${encNum(45)}~${encNum(0)}~${encNum(0)}`, encNum(0)].join('\x02')));
  const out = rec.netlog.lines().slice(since).map((l) => l.slice(14));
  assert.match(out[0], /^c\d+ server +OUT +STATE +hp 150 \| respawns 1 \| aim \+212,-40 \|/);
  assert.match(out[1], /^c\d+ server +IN +STATE +#0 hp 150 ping 45 ms$/);
});

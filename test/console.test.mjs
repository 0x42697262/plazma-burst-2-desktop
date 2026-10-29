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

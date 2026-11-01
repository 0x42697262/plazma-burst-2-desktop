import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { bootConsole, LEGACY_CONSOLE_DIR } from '../../../test/support/fake-game.mjs';

const consoleModule = (relative) => import(pathToFileURL(path.join(LEGACY_CONSOLE_DIR, relative)).href);
const errorsOf = (out) => out.filter((line) => line.startsWith('error: '));

let game;
before(async () => { game = await bootConsole({ sayTrigger: '#chat_in' }); });

test('vars sync explains, sends with the chosen mode, and refuses a mode that cannot work', () => {
  const explain = game.run('vars sync door_1');
  assert.ok(explain.some((l) => l.includes('#resync') && l.includes('mode x (max)')), 'names the trigger that re-sends it');
  assert.ok(explain.some((l) => l.includes('#init') && l.includes('one call only')), 'names the seeder');
  assert.ok(explain.some((l) => l.startsWith('  Recommended: vars sync door_1 r')));

  game.log.net.length = 0;
  game.run('vars set var_mods "CTHC Lenaa honor23"; vars sync var_mods r');
  assert.deepEqual(game.log.net, [['VSYNC', 'r', 'var_mods', 'CTHC Lenaa honor23']]);

  game.log.net.length = 0;
  assert.match(errorsOf(game.run('vars sync var_mods x'))[0], /cannot deliver/);
  game.setMP(false);
  assert.match(errorsOf(game.run('vars sync var_mods r'))[0], /single-player/);
  game.setMP(true);
  assert.deepEqual(game.log.net, [], 'nothing sent when refused');
});

test('vars set types values like the map loader does', async () => {
  const { parseVarValue } = await consoleModule('../../../src/features/triggers/vars.ts');
  // The loader's rule, from scripts/frame2.js.
  const loader = (v) => (parseInt(v) + '' === v ? parseInt(v) : v);
  for (const v of ['5', '0', '-1', '-0', '01', '3.5', '1e3', '0x10', '', 'abc', '5abc', '+5', 'NaN', '99999999']) {
    assert.ok(Object.is(parseVarValue(v), loader(v)), v);
  }
  assert.equal(parseVarValue('"5"'), '5', 'quotes force text');
});

test('triggers run broadcasts a normal run, and keeps a forced one local', () => {
  game.log.net.length = 0;
  assert.ok(game.run('triggers run #open_door')[0].endsWith('sent to all players'));
  assert.deepEqual(game.log.net, [['EXEC', 'n0', '', '']]);

  game.log.net.length = 0;
  const locked = game.triggers.findIndex((t) => t.uid === '#locked');
  assert.match(errorsOf(game.run('triggers run #locked'))[0], /is disabled/);
  const out = game.run('triggers run #locked force');
  assert.ok(out.some((l) => l.startsWith('Note: ran in your game only')));
  assert.deepEqual(game.log.net, [], 'not sent');
  assert.equal(game.triggers[locked][game.N.trigEnabled], false, 'its enabled state is put back');
});

test('the run log records runs through the game\'s runner', () => {
  game.frame(2); // hooks the triggers
  game.run('triggers history clear');
  game.run('triggers run #open_door');
  game.run('triggers run #open_door');
  assert.ok(game.run('triggers history').some((l) => l.includes('#open_door') && l.includes('ran x2')));
});

test('triggers find by: finds what runs a trigger', () => {
  // The rows of a "by:" search: [uid, what runs it].
  const found = (q) => game.run(`triggers find ${q}`).slice(1).map((l) => l.trim().split(/\s+/)[1]);
  const row = (q, uid) => game.run(`triggers find ${q}`).find((l) => l.includes(` ${uid} `)) || '';
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
  const out = game.run('triggers find by:timer a:door_1');
  assert.ok(out.some((l) => l.includes('#open_door') && l.includes('action 1')), 'actions inside timer-run triggers');
  assert.ok(!out.some((l) => l.includes(' trigger ')), 'no trigger rows once actions are asked for');
  assert.match(errorsOf(game.run('triggers find by:bogus'))[0], /by: expects one of/);
  assert.match(errorsOf(game.run('triggers find by:chat#2'))[0], /takes no number/);
  assert.match(game.run('triggers find by:#nothing')[0], /No trigger or action matches/);
});

test('regions run fires a region as if its condition were met', () => {
  const list = game.run('regions');
  assert.ok(list.some((l) => /#\d+\s+#button\s+use key\s+-> trigger #\d+ #open_door/.test(l)));
  assert.ok(list.some((l) => /#clock_switch\s+use key\s+-> timer #1 #timer\*2/.test(l)), 'a timer region names its timer');
  assert.ok(list.some((l) => /#spawn_spot\s+never/.test(l)));

  // Use key, as you: runs its trigger, and sends what the game sends, with the region.
  game.log.net.length = 0;
  const runsBefore = game.log.runs.length;
  const out = game.run('regions run #button');
  assert.match(out.at(-1), /^Ran region #0 #button: trigger #\d+ #open_door .*sent to all players/);
  assert.equal(game.log.runs.length, runsBefore + 1, 'the trigger ran through the game\'s runner');
  assert.deepEqual(game.log.net, [['EXEC', `n${game.triggers.findIndex((t) => t.uid === '#open_door')}`, 'n0', '']]);
  assert.equal(game.G[game.N.triggerActivator], -1, 'the activator is put back');

  // The mode is checked as the game would: a red-team use key refuses team 0.
  assert.match(errorsOf(game.run('regions run #red_use'))[0], /would not fire for #0: it is for team 12; #0 is on team 0\./);
  game.log.net.length = 0;
  const forced = game.run('regions run #red_use force');
  assert.ok(forced.some((l) => l.includes('forced past its condition')));
  assert.ok(forced.some((l) => l.startsWith('Note: ran in your game only') && l.includes('region\'s own condition')));
  assert.deepEqual(game.log.net, [], 'forced past the mode: not sent');

  // A use key only fires for yourself; a bot is refused.
  assert.match(errorsOf(game.run('regions run #button as 2'))[0], /only your own use key fires it/);

  // A timer region starts its timer instead of running a trigger, and is not sent.
  const timer = game.G[game.N.timers][1];
  timer[game.N.trigEnabled] = false;
  game.log.net.length = 0;
  const t = game.run('regions run #clock_switch');
  assert.match(t[0], /^Fired region #2 #clock_switch: started timer #1 #timer\*2/);
  assert.equal(timer[game.N.trigEnabled], true);
  assert.deepEqual(game.log.net, []);
  assert.ok(!game.run('triggers find by:region').some((l) => l.includes('#clock_switch')), 'a timer region starts no trigger');

  assert.match(errorsOf(game.run('regions run #spawn_spot'))[0], /runs nothing/);
  assert.match(errorsOf(game.run('regions run #nope'))[0], /no region "#nope"/);
});

test('triggers find calls: and maxcalls: compare calls', () => {
  const found = (q) => game.run(`triggers find ${q}`).slice(1).map((l) => l.trim().split(/\s+/)[1]);
  const byUid = (uid) => game.triggers.find((t) => t.uid === uid);
  const boot = byUid('#boot'), init = byUid('#init');
  boot[game.N.trigCalls] = 1; init[game.N.trigCalls] = 0; // #boot not run yet, #init used up
  assert.deepEqual(found('maxcalls:1').sort(), ['#boot', '#init'], 'one-shots');
  assert.deepEqual(found('calls:0'), ['#init'], 'used up');
  assert.deepEqual(found('maxcalls:1 calls:1'), ['#boot'], 'one-shots not run yet');
  assert.deepEqual(found('calls:<1'), ['#init']);
  assert.deepEqual(found('calls:>=1 maxcalls:<=1'), ['#boot']);
  const unlimited = game.triggers.filter((t) => t[game.N.trigMaxCalls] === -1).length;
  assert.equal(found('calls:unlimited').length, unlimited);
  assert.equal(found('calls:>5').length, unlimited, 'unlimited counts as more than any number');
  assert.equal(found('calls:!=0').length, game.triggers.length - 1);
  assert.match(game.run('triggers find calls:0')[0], /^1 trigger matches "calls:0"/, 'not "by uid"');
  assert.deepEqual(found('calls:0 uid:boot'), [], 'combines with the other terms');
  assert.match(errorsOf(game.run('triggers find calls:lots'))[0], /calls: expects a number or "unlimited"/);
  boot[game.N.trigCalls] = 1; init[game.N.trigCalls] = 1;
});

test('triggers exec runs a trigger pasted from the map editor\'s text view, once, in your game only', async () => {
  const { pasteText } = await consoleModule('../../../src/console/kernel/ui/panel.ts');
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

  const triggersBefore = game.G[game.N.triggers].length;
  game.log.ran.length = 0;
  game.log.net.length = 0;
  const out = game.run(input.value);
  assert.deepEqual(errorsOf(out), []);
  assert.equal(out[0], 'Ran pasted trigger "#trigger*1016" (5 actions)');
  assert.match(out[1], /^Note: ran in your game only/);
  assert.equal(game.log.ran.length, 1);
  const ran = game.log.ran[0];
  assert.equal(ran.i, triggersBefore, 'its own trigger, past the map\'s');
  assert.equal(ran.uid, '#trigger*1016');
  assert.equal(ran.by, game.G[game.N.me], 'you are the activator');
  assert.deepEqual(ran.types, [123, 0, 123, 26, 562]);
  // Targets as the map loader stores them: uids are indexes, whole numbers numbers.
  assert.deepEqual(ran.A, ['var_suddendeath', 0, 'var_suddendeath', 1, 'a; b']);
  assert.deepEqual(ran.B, [1, 3, '"1"', 0, 12]);
  assert.equal(game.G[game.N.triggers].length, triggersBefore, 'removed again');
  assert.deepEqual(game.log.net, [], 'not sent');
  assert.equal(game.G[game.N.triggerActivator], -1, 'activator put back');

  // The same in the multi-line form the editor shows (pb2dev.run, or a bind).
  game.log.ran.length = 0;
  assert.deepEqual(errorsOf(game.run(`triggers exec ${pasted}`)), []);
  assert.deepEqual(game.log.ran[0].B, [1, 3, '"1"', 0, 12]);

  // --check shows it, does not run it.
  game.log.ran.length = 0;
  const shown = game.run('triggers exec --check MovableTo( "#door_a", "#spawn_spot" );');
  assert.equal(shown[0], 'Pasted trigger script: 1 action, not run (--check)');
  assert.match(shown[1], /1\. MovableTo \(type 0\)\s+A = 0\s+B = 3\s+\(Movable › Force Movable 'A' move to region 'B'\)/);
  assert.equal(game.log.ran.length, 0);

  // Refusals, before anything runs.
  const err = (line) => errorsOf(game.run(line))[0] || '';
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
  assert.equal(game.log.ran.length, 0);
  assert.deepEqual(errorsOf(game.run('triggers exec --force enabled: false SetVar( "x", "1" );')), []);
  assert.equal(game.log.ran.length, 1);
  // A "#" value that is not an object stays text: a colour, a missing trigger name.
  assert.deepEqual(errorsOf(game.run('triggers exec SetVar( "name_color", "#78dbe2" );')), []);
  assert.equal(game.log.ran[1].B[0], '#78dbe2');

  // The editor's list, searchable; triggers <#> describes actions with it.
  const listed = game.run('triggers actions timer');
  assert.match(listed[0], /^Trigger actions matching "timer": 1\./);
  assert.match(listed[1], /^\s+26\s+TimerDisable\s+Timer › Deactivate Timer 'A'\s+\[A: timer, B: nochange\]/);
  assert.match(game.run('triggers actions 562')[1], /562\s+op562\s+Debug/);
  assert.ok(game.run('triggers #god').some((l) => /type 123\s.*\(Var › Skip next trigger action/.test(l)));
});

test('logic: a tree of what reaches an element and what it acts on', () => {
  const out = game.run('logic #kick');
  const i = out.indexOf('Reached from:');
  assert.match(out[i + 1], /<- #chat_in\s+trigger #\d+\s+action 1: 363 continue in trigger A/);
  assert.match(out[i + 2], /<- chat message/, 'the chat trigger is followed back to chat');
  const door = game.run('logic #door_a');
  assert.ok(door.some((l) => /<- #open_door .*action 2: 0/.test(l)), 'the action on the door');
  assert.ok(door.some((l) => /<- #sign\s+decor #0\s+attach/.test(l)), 'what is attached to it');
  assert.ok(game.run('logic #two words').some((l) => /<- #open_door .*action 3: 99 run trigger A/.test(l)), 'a uid with a space');
  assert.match(errorsOf(game.run('logic #nope'))[0], /nothing in this map is called "#nope"/);
});

test('logic show draws every link where the camera puts it', async () => {
  const view = await consoleModule('logic/view.js');
  const cam = game.G.game;
  const lineStarts = () => game.log.drawn.filter((d) => d[0] === 'moveTo').map((d) => [d[1], d[2]].join(','));
  cam.x = 100; cam.y = 50; cam.scaleX = cam.scaleY = 1;
  game.run('logic show');
  game.log.drawn.length = 0;
  const all = view.drawFrame();
  assert.ok(all.lines > 5, `${all.lines} lines`);
  // Region #button (10, 20) runs #open_door: world + camera, in game units.
  assert.ok(lineStarts().includes('110,70'), 'region at world 10,20 is drawn at 110,70');
  assert.ok(game.log.drawn.some((d) => d[0] === 'setTransform' && d[1] === 2), 'two canvas pixels per game unit');
  assert.ok(game.log.drawn.some((d) => d[0] === 'fillText' && d[1] === '#button'), 'labelled with its uid');

  cam.scaleX = cam.scaleY = 0.5; // zoom 50
  game.log.drawn.length = 0;
  view.drawFrame();
  assert.ok(lineStarts().includes('105,60'), 'zoom scales the world, not the screen offset');

  game.run('logic show start');
  const starts = view.drawFrame();
  assert.ok(starts.lines > 0 && starts.lines < all.lines, 'a kind filter draws fewer');
  game.run('logic show #door_a');
  assert.equal(view.drawFrame().lines, 2, 'around one element: its two links');

  cam.x = 1e6; // the camera far away: nothing on screen is drawn
  assert.equal(view.drawFrame().lines, 0);
  cam.x = 100; cam.scaleX = cam.scaleY = 1;
  game.run('logic hide');
  assert.equal(game.log.frames.length, 0, 'no frame left pending');
});

test('logic filters by element type', async () => {
  const view = await consoleModule('logic/view.js');
  assert.match(game.run('logic')[1], /Types: trigger \d+, .*player \d+/, 'lists the map\'s types');
  const count = (q) => Number(game.run(`logic show ${q}`)[0].match(/^Showing (\d+) link/)[1]);
  const all = count('');
  const noPlayers = count('not:player');
  assert.ok(noPlayers < all, 'not: drops links touching players');
  assert.equal(count('not:players'), noPlayers, 'plurals work');
  assert.equal(count('type:region,trigger'), count('type:regions,triggers'));
  assert.ok(count('type:region,trigger start') <= count('type:region,trigger'), 'combines with a kind');
  assert.equal(count('#door_a type:decor'), 1, 'around an element, type: picks its neighbours');
  assert.match(errorsOf(game.run('logic show type:nonsense'))[0], /this map has no "nonsense"\. Types: /);
  game.run('logic show not:player');
  game.log.drawn.length = 0;
  view.drawFrame();
  assert.ok(!game.log.drawn.some((d) => d[0] === 'fillText' && /^#player/.test(d[1])), 'no player is drawn');
  game.run('logic hide');

  const tree = game.run('logic #god_all not:player');
  assert.ok(!tree.some((l) => l.includes('#player')), 'the tree drops player rows');
  assert.ok(game.run('logic #door_a type:region').some((l) => l.includes('nothing that passes the filters')));
});

test('logic screen keeps only what the camera shows, as it moves', async () => {
  const view = await consoleModule('logic/view.js');
  const cam = game.G.game;
  const labels = () => { game.log.drawn.length = 0; view.drawFrame(); return game.log.drawn.filter((d) => d[0] === 'fillText').map((d) => d[1]); };
  const lineStarts = () => game.log.drawn.filter((d) => d[0] === 'moveTo').map((d) => `${d[1]},${d[2]}`);
  // The view covers world x -100..700, y -50..350: #god_all (40, -300) is off screen,
  // the players it acts on are on it.
  cam.x = 100; cam.y = 50; cam.scaleX = cam.scaleY = 1;
  // #god_all is at world (40, -300): screen (140, -250), above the top edge.
  game.run('logic show');
  labels();
  assert.ok(lineStarts().includes('140,-250'), 'without "screen", a link running off the edge is drawn');
  game.run('logic show screen');
  labels();
  assert.ok(!lineStarts().includes('140,-250'), 'with it, only links with both ends on screen');
  assert.ok(labels().includes('#button'), 'what is on screen still is');
  cam.y = 400; // the camera moves up: #god and #god_all come on screen (y 100), #button leaves (y 420)
  assert.ok(labels().includes('#god_all'), 'it follows the camera');
  assert.ok(!labels().includes('#button'), 'and drops what left it');
  cam.y = 50;
  assert.match(game.run('logic show visible')[0], /both ends on screen .*\d+ links? right now/);
  game.run('logic hide');

  assert.ok(game.run('logic #god_all screen').some((l) => /-> #player\*0/.test(l)), 'the tree keeps rows on screen');
  cam.x = 1e6;
  assert.ok(!game.run('logic #god_all screen').some((l) => l.includes('-> #player')), 'and drops the rest');
  cam.x = 100;
});

test('logic labels never overlap: grouped, collapsed, opened by the crosshair', async () => {
  const { layoutLabels } = await consoleModule('../../../src/console/kernel/ui/labels.ts');
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
  const original = game.G[game.N.mapText];
  try {
    game.run('editor on');
    game.G[game.N.mapText] = old;
    game.G.stage.currentFrameLabel = 'menu'; game.frame();
    game.G.stage.currentFrameLabel = 'gaming'; game.frame();
    const doc = session.editorDoc();
    assert.deepEqual(doc.byTag('timer')[0].spot, { x: 80, y: -60 }, 'where "logic show" draws it');
    session.select(doc.byTag('trigger')[0]);
    assert.equal(drawEditorFrame().links, 4, 'a region runs it; it moves a door to a region, disables a timer');
    assert.deepEqual(errorsOf(game.run('editor status')), []);
  } finally {
    session.setEditor(false); session.forgetDocument();
    game.G[game.N.mapText] = original;
  }
});

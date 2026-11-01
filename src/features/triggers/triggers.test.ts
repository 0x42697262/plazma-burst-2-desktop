import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { bootConsole, type FakeGame } from '#console/testing/fake-game.fixture.ts';
import { errorsOf } from '#console/testing/console-output.fixture.ts';

let game: FakeGame;
before(async () => { game = await bootConsole({ sayTrigger: '#chat_in' }); });

test('vars sync explains, sends with the chosen mode, and refuses a mode that cannot work', () => {
  const explain = game.run('vars sync door_1');
  assert.ok(explain.some((line) => line.includes('#resync') && line.includes('mode x (max)')), 'names the trigger that re-sends it');
  assert.ok(explain.some((line) => line.includes('#init') && line.includes('one call only')), 'names the seeder');
  assert.ok(explain.some((line) => line.startsWith('  Recommended: vars sync door_1 r')));

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

test('vars set types values like the map loader (scripts/frame2.js) does', async () => {
  const { parseVarValue } = await import('./vars.ts');
  const mapLoaderRule = (value: string) => (parseInt(value) + '' === value ? parseInt(value) : value);
  for (const value of ['5', '0', '-1', '-0', '01', '3.5', '1e3', '0x10', '', 'abc', '5abc', '+5', 'NaN', '99999999']) {
    assert.ok(Object.is(parseVarValue(value), mapLoaderRule(value)), value);
  }
  assert.equal(parseVarValue('"5"'), '5', 'quotes force text');
});

test('triggers run broadcasts a normal run, and keeps a forced one local', () => {
  game.log.net.length = 0;
  assert.ok(game.run('triggers run #open_door')[0].endsWith('sent to all players'));
  assert.deepEqual(game.log.net, [['EXEC', 'n0', '', '']]);

  game.log.net.length = 0;
  const locked = game.triggers.findIndex((trigger) => trigger.uid === '#locked');
  assert.match(errorsOf(game.run('triggers run #locked'))[0], /is disabled/);
  const out = game.run('triggers run #locked force');
  assert.ok(out.some((line) => line.startsWith('Note: ran in your game only')));
  assert.deepEqual(game.log.net, [], 'not sent');
  assert.equal(game.triggers[locked][game.names.trigEnabled], false, 'its enabled state is put back');
});

test('the run log records runs through the game\'s runner', () => {
  const framesThatHookTheTriggers = 2;
  game.frame(framesThatHookTheTriggers);
  game.run('triggers history clear');
  game.run('triggers run #open_door');
  game.run('triggers run #open_door');
  assert.ok(game.run('triggers history').some((line) => line.includes('#open_door') && line.includes('ran x2')));
});

test('triggers find by: finds what runs a trigger', () => {
  const found = (query: string) => game.run(`triggers find ${query}`).slice(1).map((line) => line.trim().split(/\s+/)[1]);
  const row = (query: string, uid: string) => game.run(`triggers find ${query}`).find((line) => line.includes(` ${uid} `)) || '';
  assert.deepEqual(found('by:region'), ['#open_door']);
  assert.match(row('by:region', '#open_door'), /by region #0 #button at 10, 20 \(use key\)/);
  assert.deepEqual(found('by:timer'), ['#open_door', '#resync']);
  assert.deepEqual(found('by:timer#0'), ['#resync'], 'index and uid differ: timer #0 is the one the map calls #Clock*7');
  assert.deepEqual(found('by:#Clock*7'), ['#resync']);
  assert.deepEqual(found('by:#clock*7'), ['#resync'], 'uids ignore case');
  assert.match(row('by:timer#0', '#resync'), /by timer #0 #Clock\*7/);
  assert.deepEqual(found('by:chat'), ['#chat_in']);
  assert.deepEqual(found('by:death'), ['#on_death']);
  assert.deepEqual(found('by:player#1'), ['#on_death']);
  assert.deepEqual(found('by:start'), ['#boot']);
  assert.match(row('by:trigger uid:kick', '#kick'), /by trigger #\d+ #chat_in \(continues in it\)/, 'a 363 jump counts: #chat_in continues in #kick');
  assert.ok(found('by:none').includes('#god'), 'nothing in the map starts #god');
  assert.ok(!found('by:none').includes('#god_all'), '#god continues in #god_all');
  assert.deepEqual(found('by:#chat_in'), ['#kick']);
});

test('triggers find by: combines with the other terms', () => {
  const out = game.run('triggers find by:timer a:door_1');
  assert.ok(out.some((line) => line.includes('#open_door') && line.includes('action 1')), 'actions inside timer-run triggers');
  assert.ok(!out.some((line) => line.includes(' trigger ')), 'no trigger rows once actions are asked for');
  assert.match(errorsOf(game.run('triggers find by:bogus'))[0], /by: expects one of/);
  assert.match(errorsOf(game.run('triggers find by:chat#2'))[0], /takes no number/);
  assert.match(game.run('triggers find by:#nothing')[0], /No trigger or action matches/);
});

test('regions run fires a region as if its condition were met', () => {
  const { globals, names } = game;
  const list = game.run('regions');
  assert.ok(list.some((line) => /#\d+\s+#button\s+use key\s+-> trigger #\d+ #open_door/.test(line)));
  assert.ok(list.some((line) => /#clock_switch\s+use key\s+-> timer #1 #timer\*2/.test(line)), 'a timer region names its timer');
  assert.ok(list.some((line) => /#spawn_spot\s+never/.test(line)));

  game.log.net.length = 0;
  const runsBefore = game.log.runs.length;
  const out = game.run('regions run #button');
  assert.match(out.at(-1) ?? '', /^Ran region #0 #button: trigger #\d+ #open_door .*sent to all players/, 'a use key, as you: runs its trigger');
  assert.equal(game.log.runs.length, runsBefore + 1, 'the trigger ran through the game\'s runner');
  assert.deepEqual(game.log.net, [['EXEC', `n${game.triggers.findIndex((trigger) => trigger.uid === '#open_door')}`, 'n0', '']], 'sends what the game sends, with the region');
  assert.equal(globals[names.triggerActivator], -1, 'the activator is put back');

  assert.match(errorsOf(game.run('regions run #red_use'))[0], /would not fire for #0: it is for team 12; #0 is on team 0\./, 'the mode is checked as the game would: a red-team use key refuses team 0');
  game.log.net.length = 0;
  const forced = game.run('regions run #red_use force');
  assert.ok(forced.some((line) => line.includes('forced past its condition')));
  assert.ok(forced.some((line) => line.startsWith('Note: ran in your game only') && line.includes('region\'s own condition')));
  assert.deepEqual(game.log.net, [], 'forced past the mode: not sent');

  assert.match(errorsOf(game.run('regions run #button as 2'))[0], /only your own use key fires it/, 'a use key only fires for yourself; a bot is refused');

  const timer = globals[names.timers][1];
  timer[names.trigEnabled] = false;
  game.log.net.length = 0;
  const timerOut = game.run('regions run #clock_switch');
  assert.match(timerOut[0], /^Fired region #2 #clock_switch: started timer #1 #timer\*2/, 'a timer region starts its timer instead of running a trigger');
  assert.equal(timer[names.trigEnabled], true);
  assert.deepEqual(game.log.net, [], 'a started timer is not sent');
  assert.ok(!game.run('triggers find by:region').some((line) => line.includes('#clock_switch')), 'a timer region starts no trigger');

  assert.match(errorsOf(game.run('regions run #spawn_spot'))[0], /runs nothing/);
  assert.match(errorsOf(game.run('regions run #nope'))[0], /no region "#nope"/);
});

test('triggers find calls: and maxcalls: compare calls', () => {
  const { names } = game;
  const found = (query: string) => game.run(`triggers find ${query}`).slice(1).map((line) => line.trim().split(/\s+/)[1] as string);
  const byUid = (uid: string) => game.triggers.find((trigger) => trigger.uid === uid);
  const boot = byUid('#boot');
  const init = byUid('#init');
  boot[names.trigCalls] = 1;
  init[names.trigCalls] = 0;
  assert.deepEqual(found('maxcalls:1').sort(), ['#boot', '#init'], 'one-shots (#boot not run yet, #init used up)');
  assert.deepEqual(found('calls:0'), ['#init'], 'used up');
  assert.deepEqual(found('maxcalls:1 calls:1'), ['#boot'], 'one-shots not run yet');
  assert.deepEqual(found('calls:<1'), ['#init']);
  assert.deepEqual(found('calls:>=1 maxcalls:<=1'), ['#boot']);
  const unlimited = game.triggers.filter((trigger) => trigger[names.trigMaxCalls] === -1).length;
  assert.equal(found('calls:unlimited').length, unlimited);
  assert.equal(found('calls:>5').length, unlimited, 'unlimited counts as more than any number');
  assert.equal(found('calls:!=0').length, game.triggers.length - 1);
  assert.match(game.run('triggers find calls:0')[0], /^1 trigger matches "calls:0"/, 'not "by uid"');
  assert.deepEqual(found('calls:0 uid:boot'), [], 'combines with the other terms');
  assert.match(errorsOf(game.run('triggers find calls:lots'))[0], /calls: expects a number or "unlimited"/);
  boot[names.trigCalls] = 1;
  init[names.trigCalls] = 1;
});

test('triggers exec runs a trigger pasted from the map editor\'s text view, once, in your game only', async () => {
  const { globals, names } = game;
  const { pasteText } = await import('#console/kernel/ui/panel.ts');
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
  const input: any = { value: '', selectionStart: 0, selectionEnd: 0 };
  assert.ok(pasteText(pasted, input), 'pasted into the empty input');
  assert.equal(input.value, 'triggers exec uid: #trigger*1016 enabled: true maxcalls: -1 next if VarA == ValueB( "var_suddendeath", "1" ); '
    + 'MovableTo( "#door_a", "#spawn_spot" ); next if VarA == ValueB( "var_suddendeath", ""1"" ); TimerDisable( "#timer*2", "0" ); op562( "a; b", "12" );', 'one line, "triggers exec" in front');
  assert.equal(input.selectionStart, input.value.length);
  assert.ok(!pasteText('pos\nheal', { value: '' } as any), 'commands are left to the browser');
  assert.ok(!pasteText('MovableTo( "#door_a", "#spawn_spot" );', { value: '' } as any), 'one line is left to the browser');

  const triggersBefore = globals[names.triggers].length;
  game.log.ran.length = 0;
  game.log.net.length = 0;
  const out = game.run(input.value);
  assert.deepEqual(errorsOf(out), []);
  assert.equal(out[0], 'Ran pasted trigger "#trigger*1016" (5 actions)');
  assert.match(out[1] ?? '', /^Note: ran in your game only/);
  assert.equal(game.log.ran.length, 1);
  const ran = game.log.ran[0];
  assert.equal(ran.i, triggersBefore, 'its own trigger, past the map\'s');
  assert.equal(ran.uid, '#trigger*1016');
  assert.equal(ran.by, globals[names.me], 'you are the activator');
  assert.deepEqual(ran.types, [123, 0, 123, 26, 562]);
  assert.deepEqual(ran.A, ['var_suddendeath', 0, 'var_suddendeath', 1, 'a; b'], 'targets as the map loader stores them: uids are indexes');
  assert.deepEqual(ran.B, [1, 3, '"1"', 0, 12], 'targets as the map loader stores them: whole numbers are numbers');
  assert.equal(globals[names.triggers].length, triggersBefore, 'removed again');
  assert.deepEqual(game.log.net, [], 'not sent');
  assert.equal(globals[names.triggerActivator], -1, 'activator put back');

  game.log.ran.length = 0;
  assert.deepEqual(errorsOf(game.run(`triggers exec ${pasted}`)), [], 'the multi-line form the editor shows (pb2dev.run, or a bind) runs too');
  assert.deepEqual(game.log.ran[0].B, [1, 3, '"1"', 0, 12]);

  game.log.ran.length = 0;
  const shown = game.run('triggers exec --check MovableTo( "#door_a", "#spawn_spot" );');
  assert.equal(shown[0], 'Pasted trigger script: 1 action, not run (--check)');
  assert.match(shown[1] ?? '', /1\. MovableTo \(type 0\)\s+A = 0\s+B = 3\s+\(Movable › Force Movable 'A' move to region 'B'\)/);
  assert.equal(game.log.ran.length, 0, '--check shows it, does not run it');

  const refusal = (line: string) => errorsOf(game.run(line))[0] || '';
  assert.match(refusal('triggers exec TimerDisable( "#timer*999", "0" );'), /line 1: this map has no timer #timer\*999/);
  assert.match(refusal('triggers exec movableto( "#door_a", "#spawn_spot" );'), /unknown action "movableto"\. Did you mean MovableTo\?/);
  assert.match(refusal('triggers exec Nope( "a", "b" );'), /unknown action "Nope"\. "triggers actions <text>" searches/);
  assert.match(refusal('triggers exec SetVar( "x", "1" ); heal'), /line 2 "heal": not an action/);
  assert.match(refusal('triggers exec color: red SetVar( "x", "1" );'), /unknown action "color: red SetVar"/);
  assert.match(refusal('triggers exec color: red'), /line 1 "color: red": "color" is not uid, enabled, maxcalls/);
  assert.match(refusal('triggers exec #god'), /"triggers run #god" runs that map trigger/);
  assert.match(refusal('triggers exec uid: #x'), /no actions in the script/);
  assert.match(refusal('triggers exec --bogus SetVar( "x", "1" );'), /unknown option "--bogus"/);
  assert.match(refusal('triggers exec'), /usage: triggers exec/);
  assert.match(refusal('triggers exec enabled: false SetVar( "x", "1" );'), /not run: it says "enabled: false"\. "triggers exec --force/);
  assert.equal(game.log.ran.length, 0, 'refusals come before anything runs');
  assert.deepEqual(errorsOf(game.run('triggers exec --force enabled: false SetVar( "x", "1" );')), []);
  assert.equal(game.log.ran.length, 1);
  assert.deepEqual(errorsOf(game.run('triggers exec SetVar( "name_color", "#78dbe2" );')), []);
  assert.equal(game.log.ran[1].B[0], '#78dbe2', 'a "#" value that is not an object (a color, a missing trigger name) stays text');

  const listed = game.run('triggers actions timer');
  assert.match(listed[0], /^Trigger actions matching "timer": 1\./, 'the editor\'s list, searchable');
  assert.match(listed[1] ?? '', /^\s+26\s+TimerDisable\s+Timer › Deactivate Timer 'A'\s+\[A: timer, B: nochange\]/);
  assert.match(game.run('triggers actions 562')[1] ?? '', /562\s+op562\s+Debug/);
  assert.ok(game.run('triggers #god').some((line) => /type 123\s.*\(Var › Skip next trigger action/.test(line)), 'triggers <#> describes actions with it');
});

test('logic: a tree of what reaches an element and what it acts on', () => {
  const out = game.run('logic #kick');
  const index = out.indexOf('Reached from:');
  assert.match(out[index + 1] ?? '', /<- #chat_in\s+trigger #\d+\s+action 1: 363 continue in trigger A/);
  assert.match(out[index + 2] ?? '', /<- chat message/, 'the chat trigger is followed back to chat');
  const door = game.run('logic #door_a');
  assert.ok(door.some((line) => /<- #open_door .*action 2: 0/.test(line)), 'the action on the door');
  assert.ok(door.some((line) => /<- #sign\s+decor #0\s+attach/.test(line)), 'what is attached to it');
  assert.ok(game.run('logic #two words').some((line) => /<- #open_door .*action 3: 99 run trigger A/.test(line)), 'a uid with a space');
  assert.match(errorsOf(game.run('logic #nope'))[0], /nothing in this map is called "#nope"/);
});

test('logic show draws every link where the camera puts it', async () => {
  const view = await import('./logic/view.ts');
  const drawFrame = () => view.drawFrame() as Record<string, any>;
  const cam = game.globals.game;
  const lineStarts = () => game.log.drawn.filter((call) => call[0] === 'moveTo').map((call) => [call[1], call[2]].join(','));
  cam.x = 100; cam.y = 50; cam.scaleX = cam.scaleY = 1;
  game.run('logic show');
  game.log.drawn.length = 0;
  const all = drawFrame();
  assert.ok(all.lines > 5, `${all.lines} lines`);
  assert.ok(lineStarts().includes('110,70'), 'region #button at world 10,20 runs #open_door: drawn at world + camera, 110,70, in game units');
  assert.ok(game.log.drawn.some((call) => call[0] === 'setTransform' && call[1] === 2), 'two canvas pixels per game unit');
  assert.ok(game.log.drawn.some((call) => call[0] === 'fillText' && call[1] === '#button'), 'labeled with its uid');

  cam.scaleX = cam.scaleY = 0.5;
  game.log.drawn.length = 0;
  drawFrame();
  assert.ok(lineStarts().includes('105,60'), 'zoom 50 scales the world, not the screen offset');

  game.run('logic show start');
  const starts = drawFrame();
  assert.ok(starts.lines > 0 && starts.lines < all.lines, 'a kind filter draws fewer');
  game.run('logic show #door_a');
  assert.equal(drawFrame().lines, 2, 'around one element: its two links');

  cam.x = 1e6;
  assert.equal(drawFrame().lines, 0, 'the camera far away: nothing on screen is drawn');
  cam.x = 100; cam.scaleX = cam.scaleY = 1;
  game.run('logic hide');
  assert.equal(game.log.frames.length, 0, 'no frame left pending');
});

test('logic filters by element type', async () => {
  const view = await import('./logic/view.ts');
  assert.match(game.run('logic')[1] ?? '', /Types: trigger \d+, .*player \d+/, 'lists the map\'s types');
  const count = (query: string) => Number(game.run(`logic show ${query}`)[0].match(/^Showing (\d+) link/)?.[1]);
  const all = count('');
  const noPlayers = count('not:player');
  assert.ok(noPlayers < all, 'not: drops links touching players');
  assert.equal(count('not:players'), noPlayers, 'plurals work');
  assert.equal(count('type:region,trigger'), count('type:regions,triggers'));
  assert.ok(count('type:region,trigger start') <= count('type:region,trigger'), 'combines with a kind');
  assert.equal(count('#door_a type:decor'), 1, 'around an element, type: picks its neighbors');
  assert.match(errorsOf(game.run('logic show type:nonsense'))[0], /this map has no "nonsense"\. Types: /);
  game.run('logic show not:player');
  game.log.drawn.length = 0;
  view.drawFrame();
  assert.ok(!game.log.drawn.some((call) => call[0] === 'fillText' && /^#player/.test(call[1])), 'no player is drawn');
  game.run('logic hide');

  const tree = game.run('logic #god_all not:player');
  assert.ok(!tree.some((line) => line.includes('#player')), 'the tree drops player rows');
  assert.ok(game.run('logic #door_a type:region').some((line) => line.includes('nothing that passes the filters')));
});

test('logic screen keeps only what the camera shows (world x -100..700, y -50..350), as it moves', async () => {
  const view = await import('./logic/view.ts');
  const cam = game.globals.game;
  const labels = () => { game.log.drawn.length = 0; view.drawFrame(); return game.log.drawn.filter((call) => call[0] === 'fillText').map((call) => call[1]); };
  const lineStarts = () => game.log.drawn.filter((call) => call[0] === 'moveTo').map((call) => `${call[1]},${call[2]}`);
  cam.x = 100; cam.y = 50; cam.scaleX = cam.scaleY = 1;
  game.run('logic show');
  labels();
  assert.ok(lineStarts().includes('140,-250'), 'without "screen", a link running off the edge is drawn: #god_all at world (40, -300) is at screen (140, -250), above the top edge');
  game.run('logic show screen');
  labels();
  assert.ok(!lineStarts().includes('140,-250'), 'with it, only links with both ends on screen');
  assert.ok(labels().includes('#button'), 'what is on screen still is');
  cam.y = 400;
  assert.ok(labels().includes('#god_all'), 'it follows the camera: moved up, #god and #god_all come on screen (y 100)');
  assert.ok(!labels().includes('#button'), 'and drops what left it: #button is at y 420');
  cam.y = 50;
  assert.match(game.run('logic show visible')[0], /both ends on screen .*\d+ links? right now/);
  game.run('logic hide');

  assert.ok(game.run('logic #god_all screen').some((line) => /-> #player\*0/.test(line)), 'the tree keeps rows on screen');
  cam.x = 1e6;
  assert.ok(!game.run('logic #god_all screen').some((line) => line.includes('-> #player')), 'and drops the rest');
  cam.x = 100;
});

test('logic labels never overlap: grouped, collapsed, opened by the crosshair', async () => {
  const { layoutLabels } = await import('#console/kernel/ui/labels.ts');
  type Box = { x: number; y: number; w: number; h: number };
  const bounds = { w: 800, h: 400 };
  const hit = (first: Box, second: Box) => first.x < second.x + second.w && second.x < first.x + first.w && first.y < second.y + second.h && second.y < first.y + first.h;
  const overlapping = (boxes: Box[]) => boxes.some((first, firstIndex) => boxes.some((second, secondIndex) => secondIndex > firstIndex && hit(first, second)));
  const at = (atX: number, atY: number, ...texts: string[]) => texts.map((text) => ({ x: atX, y: atY, text }));

  let { labels } = layoutLabels(at(100, 100, '#a', '#b', '#c'), { bounds }) as any;
  assert.equal(labels.length, 1, 'elements at the same spot share one label');
  assert.deepEqual(labels[0].lines, ['#a', '#b', '#c'], 'one uid per line');

  const five = at(100, 100, '#a', '#b', '#c', '#d', '#e');
  assert.deepEqual((layoutLabels(five, { bounds }) as any).labels[0].lines, ['#a', '#b', '+3 more'], 'a big group shows two and "+N more" until the crosshair is on it');
  ({ labels } = layoutLabels([...five, ...at(300, 300, '#far')], { cursor: { x: 103, y: 98 }, bounds }) as any);
  assert.deepEqual(labels.at(-1).lines, ['#a', '#b', '#c', '#d', '#e'], 'open, and drawn last (on top)');
  assert.equal(labels.at(-1).open, true);

  let seed = 7;
  const random = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const crowd = Array.from({ length: 150 }, (_, index) => ({ x: 300 + random() * 200, y: 150 + random() * 100, text: `#element*${index}` }));
  const crowdLayout: any = layoutLabels(crowd, { bounds });
  assert.equal(overlapping(crowdLayout.labels), false, 'a crowded screen: no two drawn labels overlap');

  const jam = Array.from({ length: 400 }, (_, index) => ({ x: 380 + (index % 20) * 2, y: 190 + Math.floor(index / 20) * 1, text: `#jam*${index}` }));
  const jamLayout: any = layoutLabels(jam, { cursor: { x: 420, y: 205 }, bounds });
  assert.ok(jamLayout.hidden > 0, `far too many for the screen: the extras are hidden (${jamLayout.hidden} hidden)`);
  assert.equal(overlapping(jamLayout.labels.filter((label: any) => !label.open)), false, 'still none overlap');
  assert.ok(jamLayout.labels.some((label: any) => label.open), 'the group under the crosshair is always drawn');
});

test('logic: old maps without uids link by number, as the game reads them', async () => {
  const { globals, names } = game;
  const { buildGraph, findNode } = await import('./logic/graph.ts');
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
  const graph: any = buildGraph(old);
  const links = graph.links.map((link: any) => `${link.from.uid} -> ${link.to.uid} (${link.kind}, ${link.label})`).sort();
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
  assert.equal(findNode(graph, 'REGION#1')?.uid, 'region#1');
  assert.equal(findNode(graph, '1'), graph.byIndex.get('trigger')[1], 'a trigger by index');
  assert.equal(graph.byIndex.get('character')[1].tag, 'enemy', 'players and enemies share the characters');
  const spot = (node: any) => [node.x, node.y];
  const aboveTopLeft = 'triggers and timers without a place sit in a row above the map\'s top left corner';
  assert.deepEqual(spot(graph.byIndex.get('trigger')[0]), [0, -60], aboveTopLeft);
  assert.deepEqual(spot(graph.byIndex.get('trigger')[1]), [40, -60], aboveTopLeft);
  assert.deepEqual(spot(graph.byIndex.get('timer')[0]), [80, -60], aboveTopLeft);

  const session: any = await import('#features/map_editor/services/session.ts');
  const { drawEditorFrame }: any = await import('#features/map_editor/ui/view.ts');
  const original = globals[names.mapText];
  try {
    game.run('editor on');
    globals[names.mapText] = old;
    globals.stage.currentFrameLabel = 'menu'; game.frame();
    globals.stage.currentFrameLabel = 'gaming'; game.frame();
    const doc = session.editorDoc();
    assert.deepEqual(doc.byTag('timer')[0].spot, { x: 80, y: -60 }, 'the editor draws them where "logic show" draws them');
    session.select(doc.byTag('trigger')[0]);
    assert.equal(drawEditorFrame().links, 4, 'a region runs it; it moves a door to a region, disables a timer');
    assert.deepEqual(errorsOf(game.run('editor status')), []);
  } finally {
    session.setEditor(false); session.forgetDocument();
    globals[names.mapText] = original;
  }
});

// desktop/hooks.js + desktop/hooks-runtime.js on a small fake game: "npm test".
// The plan is built from real files in a temp folder, then the page is played in a vm:
// the runtime, the hook files and the changed game script run in order, as in index.html.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const hooks = createRequire(import.meta.url)('../desktop/hooks.js');

// Obfuscated-looking names, Cyrillic letters included, like the real game.
const NAMES = { levelStart: '$еАT1ее', runTrigger: '$pАTIТ', mp: '$pMМ1', me: '$НAlНc' };

const GAME_JS = `
var $pMМ1 = false;
var $НAlНc = 3;
var calls = [];
function $еАT1ее(s) { calls.push(['start', s]); return 'built:' + s; }
function $pАTIТ(a, power = 1) {
  calls.push(['run', a, power]);
  if (a > 0) $pАTIТ(a - 1, power);
  return a * 10;
}
function other(x) { return x + 1; }
var delay = 1000/60;
`;

function setup(hookFiles, gameJs = GAME_JS) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb2-hooks-'));
  const gameDir = path.join(dir, 'game');
  const hooksDir = path.join(dir, 'hooks');
  fs.mkdirSync(path.join(gameDir, 'scripts'), { recursive: true });
  fs.mkdirSync(hooksDir);
  fs.writeFileSync(path.join(gameDir, 'index.html'), '<html><body><script src="scripts/game.js"></script></body></html>');
  fs.writeFileSync(path.join(gameDir, 'scripts', 'game.js'), gameJs);
  for (const [name, code] of Object.entries(hookFiles)) fs.writeFileSync(path.join(hooksDir, name), code);
  const plan = hooks.build({ gameDir, hooksDir, names: NAMES });
  const cleanup = () => fs.rmSync(dir, { recursive: true, force: true });
  return { plan, cleanup, gameJs };
}

// The page: runtime, hooks, then the (changed) game script. Returns the context.
function play(plan, gameJs = GAME_JS) {
  const sent = [];
  const errors = [];
  const ctx = {
    console: { log() {}, warn() {}, error: (...a) => errors.push(a.join(' ')) },
    setTimeout: (fn) => { Promise.resolve().then(fn); return 1; }, // async, like the real one
    fetch: async (url, opts) => { sent.push(...JSON.parse(opts.body)); return { ok: true }; },
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(hooks.runtimeScript(plan, NAMES), ctx);
  for (const h of plan.loaded) vm.runInContext(hooks.hookScript(plan, h.name), ctx);
  vm.runInContext(plan.files.get('scripts/game.js') ?? gameJs, ctx);
  return { ctx, sent, errors, run: (code) => vm.runInContext(code, ctx) };
}

test('attach: onEnter sees the arguments, onLeave the return value; send reaches the host', async () => {
  const t = setup({
    'log.js': `
      Interceptor.attach(Game.levelStart, {
        onEnter(args) { this.map = args[0]; },
        onLeave(retval) { send({ map: this.map, ret: retval.value, me: Game.read('me') }); },
      });`,
  });
  try {
    assert.deepEqual(t.plan.hooks.map((h) => h.status), ['loaded']);
    const p = play(t.plan);
    assert.equal(p.run('$еАT1ее("dm1")'), 'built:dm1');
    await new Promise((r) => setImmediate(r));
    assert.deepEqual(p.sent, [{ hook: 'log', msg: { map: 'dm1', ret: 'built:dm1', me: 3 } }]);
    assert.deepEqual(p.errors, []);
  } finally { t.cleanup(); }
});

test('the game script changes by one trampoline line only, and only targeted functions', () => {
  const t = setup({ 'a.js': 'Interceptor.attach(Game.runTrigger, {});' });
  try {
    const changed = t.plan.files.get('scripts/game.js');
    const id = t.plan.targets[NAMES.runTrigger];
    assert.equal(changed, GAME_JS.replace('function $pАTIТ(a, power = 1) {', `function $pАTIТ(a, power = 1) {${hooks.trampoline(id, NAMES.runTrigger)}`));
  } finally { t.cleanup(); }
});

test('args can be changed, retval replaced, and recursion is seen at every level', () => {
  const t = setup({
    'r.js': `
      Interceptor.attach(Game.runTrigger, {
        onEnter(args) { if (args[0] === 2) args[1] = 7; },
        onLeave(retval) { retval.replace(retval.value + 1); },
      });`,
  });
  try {
    const p = play(t.plan);
    assert.equal(p.run('$pАTIТ(2)'), 21);
    // the changed power reaches the body; the nested calls keep their own default
    assert.deepEqual(JSON.parse(p.run('JSON.stringify(calls)')), [['run', 2, 7], ['run', 1, 7], ['run', 0, 7]]);
  } finally { t.cleanup(); }
});

test('replace: the replacement runs instead, and can call the original', () => {
  const t = setup({
    'rep.js': `
      Interceptor.replace(Game.levelStart, function (s) {
        return 'wrapped(' + this.original(s.toUpperCase()) + ')';
      });`,
  });
  try {
    const p = play(t.plan);
    assert.equal(p.run('$еАT1ее("dm1")'), 'wrapped(built:DM1)');
  } finally { t.cleanup(); }
});

test('a throwing handler is reported and the game call still works', () => {
  const t = setup({ 'bad.js': 'Interceptor.attach(Game.levelStart, { onEnter() { throw new Error("oops"); } });' });
  try {
    const p = play(t.plan);
    assert.equal(p.run('$еАT1ее("x")'), 'built:x');
    assert.match(p.errors.join('\n'), /bad: error in onEnter: Error: oops/);
    assert.equal(p.run('PB2Hooks.status()[0].errors'), 1);
  } finally { t.cleanup(); }
});

test('multiplayer: false turns the handlers off while in a match', () => {
  const t = setup({
    'sp.js': `
      module.exports.multiplayer = false;
      Interceptor.replace(Game.levelStart, () => 'single-player only');`,
  });
  try {
    const p = play(t.plan);
    assert.equal(p.run('$еАT1ее("a")'), 'single-player only');
    p.run('$pMМ1 = true');
    assert.equal(p.run('$еАT1ее("a")'), 'built:a');
    assert.equal(p.run('PB2Hooks.active("sp")'), false);
  } finally { t.cleanup(); }
});

test('Script.patch: literal text with ⟨name⟩, exact count, a "$" in the replacement stays literal', () => {
  const t = setup({ 'p.js': 'Script.patch("scripts/game.js", "1000/60", "1000/$pMМ1_or_60");' });
  try {
    assert.equal(t.plan.hooks[0].status, 'loaded');
    assert.match(t.plan.files.get('scripts/game.js'), /var delay = 1000\/\$pMМ1_or_60;/);
  } finally { t.cleanup(); }
  const t2 = setup({ 'p.js': 'Script.patch("scripts/game.js", /calls\\.push\\(\\[\'(\\w+)\'/, (m, kind) => m + "/*" + kind + "*/", { count: 2 });' });
  try {
    assert.equal(t2.plan.hooks[0].status, 'loaded', t2.plan.hooks[0].error);
    assert.match(t2.plan.files.get('scripts/game.js'), /calls\.push\(\['start'\/\*start\*\//);
  } finally { t2.cleanup(); }
});

test('a hook that does not fit is left out with the reason; the others load', () => {
  const t = setup({
    '1-ok.js': 'Interceptor.attach(Game.levelStart, {});',
    '2-missing.js': 'Interceptor.attach(Game.fn("$nope"), {});',
    '3-count.js': 'Script.patch("scripts/game.js", "function", "function");',
    '4-file.js': 'Script.patch("scripts/nope.js", "a", "b");',
    '5-name.js': 'Interceptor.attach(Game.notAName, {});',
    '6-off.js': 'module.exports.enabled = false; Interceptor.attach(Game.levelStart, {});',
    '7-top.js': 'Game.read("me");',
    'skip.example.js': 'throw new Error("examples are not loaded")',
  });
  try {
    const by = Object.fromEntries(t.plan.hooks.map((h) => [h.name, h]));
    assert.deepEqual(Object.keys(by), ['1-ok', '2-missing', '3-count', '4-file', '5-name', '6-off', '7-top']);
    assert.equal(by['1-ok'].status, 'loaded');
    assert.match(by['2-missing'].error, /no "function \$nope\("/);
    assert.match(by['3-count'].error, /found 3 times, expected 1 time/);
    assert.match(by['4-file'].error, /"scripts\/nope\.js" is not one of the game's scripts/);
    assert.match(by['5-name'].error, /Game\.notAName: no such name/);
    assert.equal(by['6-off'].status, 'disabled');
    assert.match(by['7-top'].error, /only works inside handlers/);
    assert.deepEqual(t.plan.loaded.map((h) => h.name), ['1-ok']);
  } finally { t.cleanup(); }
});

test('two hooks patching the same text: the later one is dropped, the earlier stays', () => {
  const t = setup({
    'a.js': 'Script.patch("scripts/game.js", "1000/60", "1000/120");',
    'b.js': 'Script.patch("scripts/game.js", "1000/60", "1000/30");',
  });
  try {
    assert.deepEqual(t.plan.hooks.map((h) => h.status), ['loaded', 'error']);
    assert.match(t.plan.hooks[1].error, /after the hooks loaded before it/);
    assert.match(t.plan.files.get('scripts/game.js'), /1000\/120/);
  } finally { t.cleanup(); }
});

test('no hook files: nothing changes and nothing is injected', () => {
  const t = setup({ 'tpl.example.js': 'Interceptor.attach(Game.levelStart, {});' });
  try {
    assert.equal(t.plan.hooks.length, 0);
    assert.equal(t.plan.files.size, 0);
    const html = '<html><script src="a.js"></script></html>';
    assert.equal(hooks.injectTags(html, t.plan), html);
  } finally { t.cleanup(); }
});

test('injectTags puts the runtime and the loaded hooks before the first game script', () => {
  const t = setup({ 'a.js': '', 'b.js': 'module.exports.enabled = false;' });
  try {
    const out = hooks.injectTags('<head></head><script src="_strings.js"></script>', t.plan);
    assert.equal(out, '<head></head><script src="__hooks/runtime.js"></script><script src="__hooks/hook/a.js"></script><script src="_strings.js"></script>');
  } finally { t.cleanup(); }
});

test('the runtime global is invisible to for...in over globalThis (quicksave, anti-tamper scan)', () => {
  const t = setup({ 'a.js': 'Interceptor.attach(Game.levelStart, {});' });
  try {
    const p = play(t.plan);
    assert.equal(p.run('Object.keys(globalThis).includes("PB2Hooks")'), false);
    assert.equal(p.run('typeof PB2Hooks.c'), 'function');
  } finally { t.cleanup(); }
});

// A gun made while the game runs: its method exists only after levelStart.
const LATE_GAME_JS = GAME_JS + `
function Gun() {}
Gun.prototype.fire = function (n) { return 'pew' + n; };
var gun = null;
var $НAlНc2 = 0;
`;

test('Game.method: attach to a function made while the game runs, from another hook\'s onLeave', () => {
  const t = setup({
    'late.js': `
      let listener = null;
      Interceptor.attach(Game.levelStart, {
        onLeave() {
          if (listener) return;
          listener = Interceptor.attach(Game.method(globalThis.gun, 'fire'), {
            onEnter(args) { args[0] = args[0] * 10; },
            onLeave(retval) { retval.replace(retval.value + '!'); },
          });
          globalThis.detachLate = () => listener.detach();
        },
      });`,
  }, LATE_GAME_JS);
  try {
    const p = play(t.plan, LATE_GAME_JS);
    p.run('gun = new Gun()');
    assert.equal(p.run('gun.fire(1)'), 'pew1');            // not hooked yet
    p.run('$еАT1ее("dm1")');                              // the hook attaches now
    assert.equal(p.run('gun.fire(2)'), 'pew20!');
    assert.equal(p.run('new Gun().fire(3)'), 'pew3');       // only that object
    p.run('detachLate()');                                  // back to the prototype's own
    assert.equal(p.run('gun.fire(4)'), 'pew4');
    assert.equal(p.run('Object.prototype.hasOwnProperty.call(gun, "fire")'), false);
    assert.deepEqual(p.errors, []);
  } finally { t.cleanup(); }
});

test('Game.method: replace on a prototype changes every object; revert puts it back', () => {
  const t = setup({
    'proto.js': `
      Interceptor.attach(Game.levelStart, {
        onLeave() {
          Interceptor.replace(Game.method(Gun.prototype, 'fire'), function (n) { return 'click' + this.original(n); });
          globalThis.revertGun = () => Interceptor.revert(Game.method(Gun.prototype, 'fire'));
        },
      });`,
  }, LATE_GAME_JS);
  try {
    const p = play(t.plan, LATE_GAME_JS);
    p.run('$еАT1ее("dm1")');
    assert.equal(p.run('new Gun().fire(1)'), 'clickpew1');
    p.run('revertGun()');
    assert.equal(p.run('new Gun().fire(1)'), 'pew1');
  } finally { t.cleanup(); }
});

test('Game.method: refused on globalThis (anti-tamper scan), clear errors for missing ones and the top level', async () => {
  const t = setup({
    'glob.js': `
      Interceptor.attach(Game.levelStart, {
        onLeave() {
          try { Game.method(globalThis, 'other'); } catch (e) { send(e.message); }
          try { Interceptor.attach(Game.method({}, 'nope'), {}); } catch (e) { send(e.message); }
        },
      });`,
    'top.js': `Interceptor.attach(Game.method({}, 'x'), {});`,
  });
  try {
    assert.match(t.plan.hooks.find((h) => h.name === 'top').error, /Game\.method\(\) only works inside handlers/);
    const p = play(t.plan);
    const sent = [];
    p.ctx.fetch = async (u, o) => { sent.push(...JSON.parse(o.body).map((m) => m.msg)); return {}; };
    p.run('$еАT1ее("x")');
    await new Promise((r) => setImmediate(r));
    assert.match(sent[0], /globalThis are checked by the anti-tamper scan/);
    assert.match(sent[1], /method "nope" is not a function on that object \(not made yet\?/);
  } finally { t.cleanup(); }
});

test('findFunction: declarations only, with default parameters that contain parentheses and strings', () => {
  const src = 'var x={y:function $a(){}};function $a(p=f(")"),q){return 1}\nobj.function $a(){}';
  const at = hooks.findFunction(src, '$a');
  assert.equal(at.length, 2);
  assert.equal(src[at[1] - 1], '{');
  assert.equal(src.slice(at[1], at[1] + 6), 'return');
});

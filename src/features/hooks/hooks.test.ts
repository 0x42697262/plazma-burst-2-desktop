import { test, before, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { buildPlan, type Plan } from './services/plan.ts';
import { hookScript, injectTags, runtimeScript } from './entry/page.ts';
import { findFunction } from './domain/patching.ts';
import { trampoline } from './keys.ts';
import { buildHooksRuntime } from '#tools/build/build.ts';
import { obfuscateOutputs } from '#tools/build/obfuscate.ts';

const RUNTIME_BUILDS = { plain: false, obfuscated: true };
const runtimeBundles = new Map<string, string>();
let runtimeBundle = '';
before(async () => {
  for (const [build, obfuscate] of Object.entries(RUNTIME_BUILDS)) {
    const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'pb2-hooks-runtime-')), 'runtime.cjs');
    await buildHooksRuntime(out);
    if (obfuscate) await obfuscateOutputs([out], []);
    runtimeBundles.set(build, fs.readFileSync(out, 'utf8'));
  }
  assert.notEqual(runtimeBundles.get('obfuscated'), runtimeBundles.get('plain'));
});

const OBFUSCATED_NAMES_WITH_CYRILLIC = { levelStart: '$еАT1ее', runTrigger: '$pАTIТ', mp: '$pMМ1', me: '$НAlНc' };
const NAMES = OBFUSCATED_NAMES_WITH_CYRILLIC;

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

const flushPromises = () => new Promise((resolve) => setImmediate(resolve));

function setup(hookFiles: Record<string, string>, gameJs = GAME_JS) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pb2-hooks-'));
  const gameDir = path.join(dir, 'game');
  const hooksDir = path.join(dir, 'hooks');
  fs.mkdirSync(path.join(gameDir, 'scripts'), { recursive: true });
  fs.mkdirSync(hooksDir);
  fs.writeFileSync(path.join(gameDir, 'index.html'), '<html><body><script src="scripts/game.js"></script></body></html>');
  fs.writeFileSync(path.join(gameDir, 'scripts', 'game.js'), gameJs);
  for (const [name, code] of Object.entries(hookFiles)) fs.writeFileSync(path.join(hooksDir, name), code);
  const plan = buildPlan({ gameDir, hooksDir, names: NAMES });
  const cleanup = () => fs.rmSync(dir, { recursive: true, force: true });
  return { plan, cleanup, gameJs };
}

function play(plan: Plan, gameJs = GAME_JS) {
  const sent: any[] = [];
  const errors: string[] = [];
  const ctx: any = {
    console: { log() {}, warn() {}, error: (...parts: unknown[]) => errors.push(parts.join(' ')) },
    setTimeout: (callback: () => void) => { Promise.resolve().then(callback); return 1; },
    fetch: async (_url: string, opts: any) => { sent.push(...JSON.parse(opts.body)); return { ok: true }; },
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(runtimeScript({ ...plan, names: NAMES }, runtimeBundle), ctx);
  for (const hook of plan.loaded) vm.runInContext(hookScript(plan, hook.name) ?? '', ctx);
  vm.runInContext(plan.files.get('scripts/game.js') ?? gameJs, ctx);
  return { ctx, sent, errors, run: (code: string): any => vm.runInContext(code, ctx) };
}

for (const build of Object.keys(RUNTIME_BUILDS)) describe(`${build} hooks runtime`, () => {
  before(() => { runtimeBundle = runtimeBundles.get(build) ?? ''; });

  test('attach: onEnter sees the arguments, onLeave the return value; send reaches the host', async () => {
    const setupResult = setup({
      'log.js': `
        Interceptor.attach(Game.levelStart, {
          onEnter(args) { this.map = args[0]; },
          onLeave(retval) { send({ map: this.map, ret: retval.value, me: Game.read('me') }); },
        });`,
    });
    try {
      assert.deepEqual(setupResult.plan.hooks.map((hook) => hook.status), ['loaded']);
      const page = play(setupResult.plan);
      assert.equal(page.run('$еАT1ее("dm1")'), 'built:dm1');
      await flushPromises();
      assert.deepEqual(page.sent, [{ hook: 'log', msg: { map: 'dm1', ret: 'built:dm1', me: 3 } }]);
      assert.deepEqual(page.errors, []);
    } finally { setupResult.cleanup(); }
  });

  test('the game script changes by one trampoline line only, and only targeted functions', () => {
    const setupResult = setup({ 'a.js': 'Interceptor.attach(Game.runTrigger, {});' });
    try {
      const changed = setupResult.plan.files.get('scripts/game.js');
      const id = setupResult.plan.targets[NAMES.runTrigger] as number;
      assert.equal(changed, GAME_JS.replace('function $pАTIТ(a, power = 1) {', `function $pАTIТ(a, power = 1) {${trampoline(id, NAMES.runTrigger)}`));
    } finally { setupResult.cleanup(); }
  });

  test('args can be changed, retval replaced, and recursion is seen at every level', () => {
    const setupResult = setup({
      'r.js': `
        Interceptor.attach(Game.runTrigger, {
          onEnter(args) { if (args[0] === 2) args[1] = 7; },
          onLeave(retval) { retval.replace(retval.value + 1); },
        });`,
    });
    try {
      const page = play(setupResult.plan);
      assert.equal(page.run('$pАTIТ(2)'), 21);
      assert.deepEqual(JSON.parse(page.run('JSON.stringify(calls)')), [['run', 2, 7], ['run', 1, 7], ['run', 0, 7]], 'the changed power reaches the body, which passes it on to the nested calls');
    } finally { setupResult.cleanup(); }
  });

  test('replace: the replacement runs instead, and can call the original', () => {
    const setupResult = setup({
      'rep.js': `
        Interceptor.replace(Game.levelStart, function (s) {
          return 'wrapped(' + this.original(s.toUpperCase()) + ')';
        });`,
    });
    try {
      const page = play(setupResult.plan);
      assert.equal(page.run('$еАT1ее("dm1")'), 'wrapped(built:DM1)');
    } finally { setupResult.cleanup(); }
  });

  test('a throwing handler is reported and the game call still works', () => {
    const setupResult = setup({ 'bad.js': 'Interceptor.attach(Game.levelStart, { onEnter() { throw new Error("oops"); } });' });
    try {
      const page = play(setupResult.plan);
      assert.equal(page.run('$еАT1ее("x")'), 'built:x');
      assert.match(page.errors.join('\n'), /bad: error in onEnter: Error: oops/);
      assert.equal(page.run('PB2Hooks.status()[0].errors'), 1);
    } finally { setupResult.cleanup(); }
  });

  test('multiplayer: false turns the handlers off while in a match', () => {
    const setupResult = setup({
      'sp.js': `
        module.exports.multiplayer = false;
        Interceptor.replace(Game.levelStart, () => 'single-player only');`,
    });
    try {
      const page = play(setupResult.plan);
      assert.equal(page.run('$еАT1ее("a")'), 'single-player only');
      page.run('$pMМ1 = true');
      assert.equal(page.run('$еАT1ее("a")'), 'built:a');
      assert.equal(page.run('PB2Hooks.active("sp")'), false);
    } finally { setupResult.cleanup(); }
  });

  test('Script.patch: literal text with ⟨name⟩, exact count, a "$" in the replacement stays literal', () => {
    const literal = setup({ 'p.js': 'Script.patch("scripts/game.js", "1000/60", "1000/$pMМ1_or_60");' });
    try {
      assert.equal(literal.plan.hooks[0]?.status, 'loaded');
      assert.match(literal.plan.files.get('scripts/game.js') ?? '', /var delay = 1000\/\$pMМ1_or_60;/);
    } finally { literal.cleanup(); }
    const counted = setup({ 'p.js': 'Script.patch("scripts/game.js", /calls\\.push\\(\\[\'(\\w+)\'/, (m, kind) => m + "/*" + kind + "*/", { count: 2 });' });
    try {
      assert.equal(counted.plan.hooks[0]?.status, 'loaded', counted.plan.hooks[0]?.error ?? '');
      assert.match(counted.plan.files.get('scripts/game.js') ?? '', /calls\.push\(\['start'\/\*start\*\//);
    } finally { counted.cleanup(); }
  });

  test('a hook that does not fit is left out with the reason; the others load', () => {
    const setupResult = setup({
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
      const byName: Record<string, any> = Object.fromEntries(setupResult.plan.hooks.map((hook) => [hook.name, hook]));
      assert.deepEqual(Object.keys(byName), ['1-ok', '2-missing', '3-count', '4-file', '5-name', '6-off', '7-top']);
      assert.equal(byName['1-ok'].status, 'loaded');
      assert.match(byName['2-missing'].error, /no "function \$nope\("/);
      assert.match(byName['3-count'].error, /found 3 times, expected 1 time/);
      assert.match(byName['4-file'].error, /"scripts\/nope\.js" is not one of the game's scripts/);
      assert.match(byName['5-name'].error, /Game\.notAName: no such name/);
      assert.equal(byName['6-off'].status, 'disabled');
      assert.match(byName['7-top'].error, /only works inside handlers/);
      assert.deepEqual(setupResult.plan.loaded.map((hook) => hook.name), ['1-ok']);
    } finally { setupResult.cleanup(); }
  });

  test('two hooks patching the same text: the later one is dropped, the earlier stays', () => {
    const setupResult = setup({
      'a.js': 'Script.patch("scripts/game.js", "1000/60", "1000/120");',
      'b.js': 'Script.patch("scripts/game.js", "1000/60", "1000/30");',
    });
    try {
      assert.deepEqual(setupResult.plan.hooks.map((hook) => hook.status), ['loaded', 'error']);
      assert.match(setupResult.plan.hooks[1]?.error ?? '', /after the hooks loaded before it/);
      assert.match(setupResult.plan.files.get('scripts/game.js') ?? '', /1000\/120/);
    } finally { setupResult.cleanup(); }
  });

  test('no hook files: nothing changes and nothing is injected', () => {
    const setupResult = setup({ 'tpl.example.js': 'Interceptor.attach(Game.levelStart, {});' });
    try {
      assert.equal(setupResult.plan.hooks.length, 0);
      assert.equal(setupResult.plan.files.size, 0);
      const html = '<html><script src="a.js"></script></html>';
      assert.equal(injectTags(html, setupResult.plan), html);
    } finally { setupResult.cleanup(); }
  });

  test('injectTags puts the runtime and the loaded hooks before the first game script', () => {
    const setupResult = setup({ 'a.js': '', 'b.js': 'module.exports.enabled = false;' });
    try {
      const out = injectTags('<head></head><script src="_strings.js"></script>', setupResult.plan);
      assert.equal(out, '<head></head><script src="__hooks/runtime.js"></script><script src="__hooks/hook/a.js"></script><script src="_strings.js"></script>');
    } finally { setupResult.cleanup(); }
  });

  test('the runtime global is invisible to for...in over globalThis (quicksave, anti-tamper scan)', () => {
    const setupResult = setup({ 'a.js': 'Interceptor.attach(Game.levelStart, {});' });
    try {
      const page = play(setupResult.plan);
      assert.equal(page.run('Object.keys(globalThis).includes("PB2Hooks")'), false);
      assert.equal(page.run('typeof PB2Hooks.c'), 'function');
    } finally { setupResult.cleanup(); }
  });

  const GAME_JS_WITH_A_GUN_MADE_AFTER_LEVEL_START = GAME_JS + `
  function Gun() {}
  Gun.prototype.fire = function (n) { return 'pew' + n; };
  var gun = null;
  var $НAlНc2 = 0;
  `;
  const LATE_GAME_JS = GAME_JS_WITH_A_GUN_MADE_AFTER_LEVEL_START;

  test('Game.method: attach to a function made while the game runs, from another hook\'s onLeave', () => {
    const setupResult = setup({
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
      const page = play(setupResult.plan, LATE_GAME_JS);
      page.run('gun = new Gun()');
      assert.equal(page.run('gun.fire(1)'), 'pew1', 'not hooked yet');
      page.run('$еАT1ее("dm1")');
      assert.equal(page.run('gun.fire(2)'), 'pew20!', 'the hook attached when the level started');
      assert.equal(page.run('new Gun().fire(3)'), 'pew3', 'only that object');
      page.run('detachLate()');
      assert.equal(page.run('gun.fire(4)'), 'pew4', 'back to the prototype\'s own');
      assert.equal(page.run('Object.prototype.hasOwnProperty.call(gun, "fire")'), false);
      assert.deepEqual(page.errors, []);
    } finally { setupResult.cleanup(); }
  });

  test('Game.method: replace on a prototype changes every object; revert puts it back', () => {
    const setupResult = setup({
      'proto.js': `
        Interceptor.attach(Game.levelStart, {
          onLeave() {
            Interceptor.replace(Game.method(Gun.prototype, 'fire'), function (n) { return 'click' + this.original(n); });
            globalThis.revertGun = () => Interceptor.revert(Game.method(Gun.prototype, 'fire'));
          },
        });`,
    }, LATE_GAME_JS);
    try {
      const page = play(setupResult.plan, LATE_GAME_JS);
      page.run('$еАT1ее("dm1")');
      assert.equal(page.run('new Gun().fire(1)'), 'clickpew1');
      page.run('revertGun()');
      assert.equal(page.run('new Gun().fire(1)'), 'pew1');
    } finally { setupResult.cleanup(); }
  });

  test('Game.method: refused on globalThis (anti-tamper scan), clear errors for missing ones and the top level', async () => {
    const setupResult = setup({
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
      assert.match(setupResult.plan.hooks.find((hook) => hook.name === 'top')?.error ?? '', /Game\.method\(\) only works inside handlers/);
      const page = play(setupResult.plan);
      const sent: string[] = [];
      page.ctx.fetch = async (_url: string, opts: any) => { sent.push(...JSON.parse(opts.body).map((message: any) => message.msg)); return {}; };
      page.run('$еАT1ее("x")');
      await flushPromises();
      assert.match(sent[0] ?? '', /globalThis are checked by the anti-tamper scan/);
      assert.match(sent[1] ?? '', /method "nope" is not a function on that object \(not made yet\?/);
    } finally { setupResult.cleanup(); }
  });
});

test('findFunction: declarations only, with default parameters that contain parentheses and strings', () => {
  const src = 'var x={y:function $a(){}};function $a(p=f(")"),q){return 1}\nobj.function $a(){}';
  const at = findFunction(src, '$a');
  assert.equal(at.length, 2);
  const bodyStart = at[1] as number;
  assert.equal(src[bodyStart - 1], '{');
  assert.equal(src.slice(bodyStart, bodyStart + 6), 'return');
});

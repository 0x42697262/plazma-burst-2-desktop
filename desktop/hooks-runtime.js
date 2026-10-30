// Hooks runtime, in the game page before the game's own scripts (see desktop/hooks.js).
// desktop/hooks.js serves this file with "(config);" appended, so it runs once with the
// plan: { names, targets: { obfuscated name -> id }, sendUrl, hooks: [...] }.
//
// It defines one global, PB2Hooks (not enumerable, so the game's quicksave and anti-tamper
// scan, which walk globalThis with for...in, never see it):
//   PB2Hooks.t(id)                 trampoline check: does target id have handlers?
//   PB2Hooks.c(id, this, args, fn) runs the handlers around the original function
//   PB2Hooks.define(name, body)    runs a hook file with its own Interceptor, Script, Game, send
//   PB2Hooks.active(name)          is the hook on right now (loaded, and allowed in this mode)
//   PB2Hooks.status()              every hook, for the dev console's "hooks" command
// The API given to hook files follows Frida's: Interceptor.attach(target, { onEnter(args),
// onLeave(retval) }) with `this` a per-call context, retval.replace(v), Interceptor.replace,
// Interceptor.revert, listener.detach(), send(message).
(function (CONFIG) {
  'use strict';

  const TAG = '[hooks]';
  const SEND_DELAY_MS = 50; // send() batches messages for this long
  const TARGET = Symbol.for('pb2hooks.target');

  const names = CONFIG.names || {};
  const idOf = CONFIG.targets || {};
  const listeners = [];    // id -> [{ hook, onEnter, onLeave }]
  const replacements = []; // id -> { hook, impl }
  const hooks = new Map(CONFIG.hooks.map((h) => [h.name, { ...h, errors: 0 }]));
  let skip = -1;           // id whose next trampoline check must let the original run

  // ----- game values by names.js key -----
  const getters = new Map();
  const setters = new Map();
  const nameOf = (key) => {
    if (!names[key]) throw new Error(`Game: no name "${key}" in desktop/dev/names.js (run "npm run find-names")`);
    return names[key];
  };
  function read(key) {
    let f = getters.get(key);
    if (!f) {
      const n = nameOf(key);
      // Indirect eval runs in global scope, so it reaches the game's top-level let/const too.
      f = (0, eval)(`(() => typeof ${n} === 'undefined' ? undefined : ${n})`);
      getters.set(key, f);
    }
    return f();
  }
  function write(key, value) {
    let f = setters.get(key);
    if (!f) { f = (0, eval)(`((v) => { ${nameOf(key)} = v; })`); setters.set(key, f); }
    f(value);
  }
  function isMP() {
    try { return !!read('mp'); } catch { return false; }
  }
  const allowed = (hook) => hook.status === 'loaded' && (hook.multiplayer !== false || !isMP());

  function report(hook, where, e) {
    hook.errors++;
    console.error(`${TAG} ${hook.name}: error in ${where}: ${(e && e.stack) || e}`);
  }

  // ----- send(): to the terminal running "npm start" -----
  let queue = [];
  let timer = null;
  function flush() {
    timer = null;
    const batch = queue;
    queue = [];
    fetch(CONFIG.sendUrl, { method: 'POST', body: JSON.stringify(batch) }).catch(() => {});
  }
  function send(hook, message) {
    let msg = message;
    try { JSON.stringify(msg); } catch { msg = String(message); }
    queue.push({ hook: hook.name, msg });
    if (!timer) timer = setTimeout(flush, SEND_DELAY_MS);
  }

  // ----- calls -----
  class RetVal {
    constructor(value) { this.value = value; }
    replace(value) { this.value = value; }
    toString() { return String(this.value); }
  }

  function t(id) {
    if (skip === id) { skip = -1; return false; }
    const list = listeners[id];
    return !!((list && list.length) || replacements[id]);
  }

  function c(id, self, argsObj, fn) {
    const args = Array.prototype.slice.call(argsObj);
    const list = (listeners[id] || []).filter((l) => allowed(l.hook));
    const rep = replacements[id] && allowed(replacements[id].hook) ? replacements[id] : null;
    // Frida: `this` in onEnter/onLeave is a context for this one call; keep your own
    // values on it between onEnter and onLeave.
    const ctxs = list.map((l) => ({ thisArg: self, hook: l.hook.name }));
    for (let i = 0; i < list.length; i++) {
      if (!list[i].onEnter) continue;
      try { list[i].onEnter.call(ctxs[i], args); } catch (e) { report(list[i].hook, 'onEnter', e); }
    }
    const original = (a) => { skip = id; return fn.apply(self, a); };
    let ret;
    if (rep) {
      let failed = false;
      const ctx = { thisArg: self, hook: rep.hook.name, original: (...a) => original(a) };
      try { ret = rep.impl.apply(ctx, args); } catch (e) { report(rep.hook, 'replacement', e); failed = true; }
      if (failed) ret = original(args);
    } else {
      ret = original(args);
    }
    if (list.some((l) => l.onLeave)) {
      const rv = new RetVal(ret);
      for (let i = list.length - 1; i >= 0; i--) {
        if (!list[i].onLeave) continue;
        try { list[i].onLeave.call(ctxs[i], rv); } catch (e) { report(list[i].hook, 'onLeave', e); }
      }
      ret = rv.value;
    }
    return ret;
  }

  // ----- the API a hook file gets -----
  function resolve(target, api) {
    if (!target || !target[TARGET]) throw new Error(`${api}: the target must be Game.<name> or Game.fn("<obfuscated name>")`);
    const id = idOf[target.name];
    if (id === undefined) throw new Error(`${api}: ${target.key || target.name} is not instrumented. Targets must be fixed (Game.<name>), so the loader can see them before the game loads; see hooks/README.md`);
    return id;
  }

  function apiFor(hook) {
    const mine = [];
    const Interceptor = {
      attach(target, callbacks = {}) {
        const id = resolve(target, 'Interceptor.attach');
        const l = { hook, onEnter: callbacks.onEnter, onLeave: callbacks.onLeave };
        (listeners[id] = listeners[id] || []).push(l);
        mine.push([id, l]);
        return {
          detach() {
            const list = listeners[id] || [];
            const k = list.indexOf(l);
            if (k >= 0) list.splice(k, 1);
          },
        };
      },
      replace(target, impl) {
        if (typeof impl !== 'function') throw new Error('Interceptor.replace: the replacement must be a function');
        const id = resolve(target, 'Interceptor.replace');
        const prev = replacements[id];
        if (prev && prev.hook !== hook) console.warn(`${TAG} ${hook.name}: replaces ${target.key || target.name}, which ${prev.hook.name} had replaced`);
        replacements[id] = { hook, impl };
      },
      revert(target) {
        const id = resolve(target, 'Interceptor.revert');
        if (replacements[id] && replacements[id].hook === hook) replacements[id] = undefined;
      },
      detachAll() {
        for (const [id, l] of mine) {
          const list = listeners[id] || [];
          const k = list.indexOf(l);
          if (k >= 0) list.splice(k, 1);
        }
        mine.length = 0;
      },
    };
    // Patches were applied by the loader before the game loaded; nothing to do here.
    const Script = { patch() {} };
    const Game = new Proxy({}, {
      get(_, key) {
        if (typeof key !== 'string') return undefined;
        if (key === 'read') return read;
        if (key === 'write') return write;
        if (key === 'isMP') return isMP;
        if (key === 'names') return { ...names };
        if (key === 'fn') return (name) => ({ [TARGET]: true, key: null, name: String(name) });
        return { [TARGET]: true, key, name: nameOf(key) };
      },
    });
    return { Interceptor, Script, Game, send: (msg) => send(hook, msg), detachAll: Interceptor.detachAll };
  }

  function define(name, body) {
    const hook = hooks.get(name);
    if (!hook) return;
    const api = apiFor(hook);
    const module = { exports: {} };
    try {
      body.call(undefined, api.Interceptor, api.Script, api.Game, api.send, module, module.exports);
    } catch (e) {
      api.detachAll();
      hook.status = 'error';
      hook.error = `in the game: ${(e && e.message) || e}`;
      report(hook, 'its top level (hook turned off)', e);
    }
  }

  const status = () => [...hooks.values()].map((h) => ({
    name: h.name,
    status: h.status,
    error: h.error,
    multiplayer: h.multiplayer,
    description: h.description,
    functions: h.functions.slice(),
    patches: h.patches,
    errors: h.errors,
    activeNow: allowed(h),
  }));

  Object.defineProperty(globalThis, 'PB2Hooks', {
    value: Object.freeze({ t, c, define, active: (name) => { const h = hooks.get(name); return !!h && allowed(h); }, status }),
    enumerable: false,
    writable: false,
    configurable: false,
  });
})

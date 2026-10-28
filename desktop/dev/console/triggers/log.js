// Records every trigger run, whatever started it (region, timer, shot, death, chat,
// network, another trigger, "triggers run").
// How: the game's runner reads a trigger's "enabled" flag exactly once per run, at the
// start. Each trigger object in the map's triggers array is wrapped in a Proxy that
// notices that read when the caller is the runner. No game function is replaced (the
// anti-tamper scan compares function source). Accessor properties are not used either:
// quicksave skips them, so F5/F9 would lose the enabled state. A Proxy keeps plain data
// properties, so quicksave and everything else see no change.
// Limit: triggers that run while the map loads ("at start") run before the wrap.
import { game } from '../game/bindings.js';
import { F } from '../game/fields.js';
import { isActive } from '../game/level.js';
import { KEY } from '../state/schema.js';
import { settings } from '../state/store.js';

export const TRIG_HISTORY_MAX = 1000;
// A refused attempt is merged with one this many entries back: regions retry every frame.
const REFUSED_MERGE_WINDOW = 20;
const FULL_CHECK_EVERY = 60; // frames; quickload may swap the trigger objects

const runs = []; // oldest first: { idx, uid, by, ok, why, count, first, last }
const targetOf = new WeakMap(); // proxy -> trigger object
const indexOf = new WeakMap(); // trigger object -> index
let hookedArr = null;
let hookedCount = -1;
let mapOfRuns = null; // the map text the runs belong to
let frameNo = 0;

export const triggerRuns = () => runs;
export const clearTriggerRuns = () => { runs.length = 0; };
// The trigger itself, for a proxy this installed (console reads are not logged).
export const unwrap = (t) => targetOf.get(t) || t;

// The runner's own check: enabled, with calls left (-1 = unlimited).
export const isUsable = (t) => !!t[F.T_ENABLED] && (t[F.T_CALLS] === -1 || t[F.T_CALLS] > 0);

// Name of the function that made the property read (the frame above the trap).
function callerName(skipFn) {
  const prevLimit = Error.stackTraceLimit;
  const prevPrepare = Error.prepareStackTrace;
  try {
    Error.stackTraceLimit = 1;
    Error.prepareStackTrace = (_, frames) => frames;
    const holder = {};
    Error.captureStackTrace(holder, skipFn);
    const frame = holder.stack && holder.stack[0];
    return frame ? frame.getFunctionName() : null;
  } finally {
    Error.stackTraceLimit = prevLimit;
    Error.prepareStackTrace = prevPrepare;
  }
}

function logRun(t) {
  const idx = indexOf.get(t);
  const ok = isUsable(t);
  const by = game.triggerActivator();
  const now = performance.now();
  // Merge repeats: a run right after the same run, or a refused attempt seen recently,
  // so they do not flood the list.
  const look = ok ? 1 : REFUSED_MERGE_WINDOW;
  for (let k = runs.length - 1; k >= Math.max(0, runs.length - look); k--) {
    const h = runs[k];
    if (h.idx === idx && h.by === by && h.ok === ok) {
      h.count++;
      h.last = now;
      if (k !== runs.length - 1) runs.push(runs.splice(k, 1)[0]);
      return;
    }
  }
  const why = ok ? '' : !t[F.T_ENABLED] ? 'disabled' : 'no calls left';
  runs.push({ idx, uid: t.uid, by, ok, why, count: 1, first: now, last: now });
  if (runs.length > TRIG_HISTORY_MAX) runs.splice(0, runs.length - TRIG_HISTORY_MAX);
}

const proxyHandler = {
  get: function trapGet(t, prop) {
    if (prop === F.T_ENABLED && callerName(trapGet) === game.runTriggerName()) {
      try { logRun(t); } catch {}
    }
    return t[prop];
  },
};

function unhookAll() {
  if (!hookedArr) return;
  for (let i = 0; i < hookedArr.length; i++) { const t = targetOf.get(hookedArr[i]); if (t) hookedArr[i] = t; }
  hookedArr = null;
  hookedCount = -1;
}

// Called every frame: wraps new triggers (a new map), unwraps when recording is off.
export function syncTriggerHooks() {
  const mapText = game.mapText();
  if (mapText !== mapOfRuns) { mapOfRuns = mapText; clearTriggerRuns(); }
  const arr = game.triggers();
  const n = game.triggerCount();
  if (!(settings.effective(KEY.TRIGGER_HISTORY) && isActive() && Array.isArray(arr) && typeof n === 'number')) {
    unhookAll();
    return;
  }
  // Cheap check each frame, full check every FULL_CHECK_EVERY frames.
  const same = arr === hookedArr && n === hookedCount && (n === 0 || (targetOf.has(arr[0]) && targetOf.has(arr[n - 1])));
  if (same && ++frameNo % FULL_CHECK_EVERY) return;
  for (let i = 0; i < n; i++) {
    const t = arr[i];
    if (!t || typeof t !== 'object' || targetOf.has(t)) continue;
    const p = new Proxy(t, proxyHandler);
    targetOf.set(p, t);
    indexOf.set(t, i);
    arr[i] = p;
  }
  hookedArr = arr;
  hookedCount = n;
}

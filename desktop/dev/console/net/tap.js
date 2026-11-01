// Several console modules listening to one game method: the network recorder
// (net/recorder.js) and the fingerprinter capture (net/fingerprint.js) both want every
// raw packet a connection receives. Each wrapping the method on its own would stack
// wrappers that cannot be taken off in any order, so there is one wrapper per object and
// method, and each module adds and removes only its own listener. The wrapper goes when
// its last listener does, restoring the method as it was: like the recorder's own
// wrappers, it is only on the connection object, only while someone listens (the
// anti-tamper scan compares globals and classes, docs/research/anticheat.md §6).
const TAP = Symbol('pb2dev tap');

// listener(...args) runs before the method, with the same arguments; what it throws is
// its own business (listeners catch their errors), the method always runs.
export function tap(obj, key, owner, listener) {
  if (!obj) return;
  let cur = obj[key];
  if (typeof cur !== 'function') return;
  if (!cur[TAP]) {
    const orig = cur;
    const listeners = new Map();
    cur = function () {
      for (const fn of listeners.values()) {
        try { fn.apply(this, arguments); } catch {}
      }
      return orig.apply(this, arguments);
    };
    cur[TAP] = { own: Object.hasOwn(obj, key) ? orig : null, listeners };
    obj[key] = cur;
  }
  cur[TAP].listeners.set(owner, listener);
}

export function untap(obj, key, owner) {
  if (!obj || !Object.hasOwn(obj, key)) return;
  const cur = obj[key];
  if (!cur || !cur[TAP]) return;
  const { own, listeners } = cur[TAP];
  listeners.delete(owner);
  if (listeners.size) return;
  if (own) obj[key] = own;
  else delete obj[key];
}

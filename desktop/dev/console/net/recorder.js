// Network recorder: every packet on the game's connections, as readable lines. The lines
// go to the desktop wrapper, which writes them to netlogs/<run>_<instance>.log
// (desktop/netlog.js); "netlog" shows them. Console key net_log (on by default) turns it
// on and off, net_log_state adds every unreliable state update, net_log_all every packet
// (PKT lines) and every state update.
//
// The game's protocol (scripts/connection.js; ANTICHEAT.md §13.3): a packet is text,
// fields split by \x01 (escaped "$.1" inside a field):
//   ack | latest unreliable state | uid | reliable message | uid | reliable message ...
// - ack: the highest reliable sequence number (uid) received in order.
// - state: one unreliable message, the newest; an unsent older one is replaced.
// - reliable messages: numbered 0, 1, 2 ... per connection and sent again until the other
//   side acknowledges them (once 2 s pass with nothing sent, 6 s after a big one). Parts are split by
//   \x02 (escaped "$.2"); part 0 is its type, an encoded number (net type names map it to
//   "RELIABLE_...").
// - numbers inside messages are written in base N with the game's digits: the characters
//   1-126 except a few, so they look like control characters and punctuation.
// Packets go over a socket.io socket, sent "volatile" (dropped when the socket is busy),
// or a peer-to-peer data channel (unordered, never retransmitted).
//
// What counts as packet loss here:
//   resend     a reliable message sent again: not acknowledged in time, so a packet (or
//              its acknowledgement) was lost or late
//   dropped    socket.io dropped a packet before sending it (the socket was busy)
//   gap        a reliable message arrived before an earlier one: lost or out of order
//   late       a message from a gap arrived (with how long it took)
//   duplicate  a reliable message arrived twice: the other side resent it
// Unreliable state updates have no number, so their loss cannot be seen one by one; the
// STAT line counts them per second.
//
// How: the connection's receive method, its socket's emit and its peer's send are wrapped
// on each connection object, only while net_log is on. Nothing global or on the network
// class is replaced (those are what the anti-tamper scan compares, ANTICHEAT.md §6).
import { game } from '../game/bindings.js';
import { KEY } from '../state/schema.js';
import { settings } from '../state/store.js';
import { ROUTE } from '../core/shared.js';

const FIELD = '\x01';
const PART = '\x02';
const ESC_FIELD = '$.1';
const ESC_PART = '$.2';
const SOCKET_EVENT = 'm'; // the game's one socket.io event, both ways
const WRAP = Symbol('pb2dev netlog wrapper');

export const NET_TICK_MS = 50;
const FLUSH_MS = 500;
const STAT_MS = 1000;
const BUFFER_MAX = 5000; // this page's lines, for "netlog show" without the wrapper
const PENDING_MAX = 20000; // lines waiting for the wrapper
const PART_CHARS_MAX = 2000; // a longer part (a map chunk, a match list) is cut
const CONN_WIDTH = 13;
const PING_NONE = 9999; // the game's ping with no samples

const two = (n, w = 2) => String(n).padStart(w, '0');
export const clock = (t) => {
  const d = new Date(t);
  return `${two(d.getHours())}:${two(d.getMinutes())}:${two(d.getSeconds())}.${two(d.getMilliseconds(), 3)}`;
};
// Packet sizes are text lengths (the game counts them the same way).
const kb = (n) => (n < 10240 ? `${n} chars` : `${(n / 1024).toFixed(1)}K chars`);
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

// ---------------------------------------------------------------------------
// Decoding: a message is written like a call, TYPE(part, part, ...), with numbers bare,
// text in quotes and JSON as it is.
// ---------------------------------------------------------------------------
const unescField = (s) => s.split(ESC_FIELD).join(FIELD);
const unescPart = (s) => s.split(ESC_FIELD).join(FIELD).split(ESC_PART).join(PART);

const TYPE_PREFIX = 'RELIABLE_'; // every reliable type name starts with it; left out
// Parts that are always an encoded number, even when it looks like a letter: the callback
// ID a RESPONSE answers (the game's counter starts at 100, so most IDs are one letter).
const NUMBER_PARTS = Object.freeze({ RESPONSE: [1] });

// A number in the game's digits, or null when the text is not one.
export function decodeNumber(text, digits) {
  if (!digits || typeof text !== 'string' || !text) return null;
  const neg = text[0] === '-';
  if (neg && text.length === 1) return null;
  let n = 0;
  for (let i = neg ? 1 : 0; i < text.length; i++) {
    const d = digits.indexOf(text[i]);
    if (d < 0) return null;
    n = n * digits.length + d;
  }
  return neg ? -n : n;
}

const CONTROL = /[\x00-\x1f\x7f]/;
const isJson = (p) => {
  if (!/^[[{]/.test(p)) return false;
  try { JSON.parse(p); return true; } catch { return false; }
};
// A part as it is shown: a bare number for an encoded number (control characters and only
// digits, or a part that is always a number), JSON as it is, any other text in quotes.
export function showPart(p, digits, isNumber = false) {
  if (isNumber || CONTROL.test(p)) {
    const n = decodeNumber(p, digits);
    if (n !== null) return String(n);
  }
  if (p.length > PART_CHARS_MAX) return `${JSON.stringify(p.slice(0, PART_CHARS_MAX))}...(${p.length} chars)`;
  return isJson(p) ? p : JSON.stringify(p);
}

// A packet: { ack, state, rel: [{ uid, data }] }.
export function parsePacket(text) {
  const f = text.split(FIELD).map(unescField);
  const rel = [];
  for (let i = 2; i + 1 < f.length; i += 2) rel.push({ uid: parseInt(f[i], 10), data: f[i + 1] });
  return { ack: parseInt(f[0], 10), state: f[1] || '', rel };
}

// A reliable message: { name, text }: name is its type without RELIABLE_ ("CHAT"), text is
// 'CHAT("hello", 7)'.
export function describeMessage(data, digits, typeName) {
  const parts = data.split(PART).map(unescPart);
  const type = decodeNumber(parts[0], digits);
  const full = type !== null ? typeName(type) : null;
  const name = full ? full.replace(TYPE_PREFIX, '') : `TYPE_${type !== null ? type : '?'}`;
  const numbers = NUMBER_PARTS[name] || [];
  const args = parts.slice(1).map((p, i) => showPart(p, digits, numbers.includes(i + 1))).join(', ');
  return { name, text: `${name}(${args})` };
}

const describeState = (data, digits) => `(${data.split(PART).map(unescPart).map((p) => showPart(p, digits)).join(', ')})`;

// "#4", "#4-#6".
const range = (a, b) => (a === b ? `#${a}` : `#${a}-#${b}`);

// ---------------------------------------------------------------------------
// Recording
// ---------------------------------------------------------------------------
const recs = new Map(); // connection -> record
let nextId = 1;
const lines = []; // this page's lines, oldest first (the last BUFFER_MAX)
let pending = []; // not sent to the wrapper yet
let on = false;
let started = false;
let lastStat = 0;
let lastFlush = 0;
let flushing = false;
let file = null; // where the wrapper writes, from its answer
let run = null;
let writeError = null;
let pageLines = 0;

const newCounts = () => ({ pkOut: 0, bytesOut: 0, pkIn: 0, bytesIn: 0, relOut: 0, relIn: 0, stateOut: 0, stateIn: 0, resends: 0, dropped: 0, gaps: 0, late: 0, dups: 0 });

function emit(rec, dir, kind, text, t = Date.now()) {
  const conn = rec ? `c${rec.id} ${rec.kind}` : '--';
  const line = `${clock(t)}  ${conn.padEnd(CONN_WIDTH)}  ${dir.padEnd(3)}  ${kind.padEnd(5)}  ${text}`;
  lines.push(line);
  if (lines.length > BUFFER_MAX) lines.splice(0, lines.length - BUFFER_MAX);
  pending.push(line);
  if (pending.length > PENDING_MAX) pending.splice(0, pending.length - PENDING_MAX);
  pageLines++;
}

const count = (rec, k, n = 1) => { rec.sec[k] += n; rec.total[k] += n; };
const digitsNow = () => { try { return game.netDigits(); } catch { return ''; } };
const typeNameNow = (type) => { try { return game.netTypeName(type); } catch { return null; } };
const allOn = () => settings.effective(KEY.NET_LOG_ALL) === true;
const stateOn = () => allOn() || settings.effective(KEY.NET_LOG_STATE) === true;

// net_log_all: one line per packet, before what it carries (the REL and STATE lines
// after it show the contents).
function packetLine(rec, dir, text, p, t) {
  const digits = digitsNow();
  const ack = Number.isNaN(p.ack) || p.ack < 0 ? 'ack none' : `ack #${p.ack}`;
  const what = [];
  if (p.state) what.push(`state (${plural(p.state.split(PART).length, 'part')})`);
  for (const { uid, data } of p.rel) what.push(`#${uid} ${describeMessage(data, digits, typeNameNow).name}`);
  emit(rec, dir, 'PKT', `${text.length} chars | ${ack} | ${what.length ? what.join(', ') : 'nothing else'}`, t);
}

function onOut(rec, text, dropped, t = Date.now()) {
  count(rec, 'pkOut');
  count(rec, 'bytesOut', text.length);
  const p = parsePacket(text);
  const digits = digitsNow();
  if (allOn()) packetLine(rec, 'OUT', text, p, t);
  if (!Number.isNaN(p.ack)) rec.ackOut = p.ack;
  if (p.state) {
    count(rec, 'stateOut');
    if (stateOn()) emit(rec, 'OUT', 'STATE', describeState(p.state, digits), t);
  }
  for (const { uid, data } of p.rel) {
    if (Number.isNaN(uid)) continue;
    const sent = rec.unacked.get(uid);
    if (uid > rec.maxOut) {
      rec.maxOut = uid;
      const m = describeMessage(data, digits, typeNameNow);
      rec.unacked.set(uid, { t, tries: 1, name: m.name });
      count(rec, 'relOut');
      emit(rec, 'OUT', 'REL', `#${uid} ${m.text}`, t);
    } else {
      count(rec, 'resends');
      const name = sent ? sent.name : describeMessage(data, digits, typeNameNow).name;
      if (sent) sent.tries++;
      emit(rec, 'OUT', 'LOSS', `resend #${uid} ${name}${sent ? ` (try ${sent.tries}, first sent ${t - sent.t} ms ago, not acknowledged yet)` : ' (not acknowledged yet)'}`, t);
    }
  }
  if (dropped) {
    count(rec, 'dropped');
    emit(rec, 'OUT', 'LOSS', `dropped: the socket was busy, socket.io did not send this packet (${plural(p.rel.length, 'reliable message')}, sent again later${p.state ? '; its state update is lost' : ''})`, t);
  }
}

function onIn(rec, text, t = Date.now()) {
  count(rec, 'pkIn');
  count(rec, 'bytesIn', text.length);
  const p = parsePacket(text);
  const digits = digitsNow();
  if (allOn()) packetLine(rec, 'IN', text, p, t);
  // Their ack: our messages up to it arrived.
  if (!Number.isNaN(p.ack)) for (const uid of rec.unacked.keys()) if (uid <= p.ack) rec.unacked.delete(uid);
  if (p.state) {
    count(rec, 'stateIn');
    if (stateOn()) emit(rec, 'IN', 'STATE', describeState(p.state, digits), t);
  }
  const uids = p.rel.map((r) => r.uid).filter((u) => !Number.isNaN(u));
  // Recording started while the connection was already busy: start counting here.
  if (rec.contig === null && uids.length) rec.contig = Math.min(...uids) - 1;
  for (const { uid, data } of p.rel) {
    if (Number.isNaN(uid)) continue;
    if (uid <= rec.contig || rec.seen.has(uid)) {
      count(rec, 'dups');
      emit(rec, 'IN', 'LOSS', `duplicate #${uid} ${describeMessage(data, digits, typeNameNow).name} (arrived before: the other side resent it, our acknowledgement was lost or late)`, t);
      continue;
    }
    count(rec, 'relIn');
    emit(rec, 'IN', 'REL', `#${uid} ${describeMessage(data, digits, typeNameNow).text}`, t);
    const gapAt = rec.missing.get(uid);
    if (gapAt !== undefined) {
      rec.missing.delete(uid);
      count(rec, 'late');
      emit(rec, 'IN', 'LOSS', `late #${uid} arrived ${t - gapAt} ms after the gap was seen`, t);
    }
    if (uid > rec.contig + 1) {
      const fresh = [];
      for (let u = rec.contig + 1; u < uid; u++) if (!rec.seen.has(u) && !rec.missing.has(u)) { rec.missing.set(u, t); fresh.push(u); }
      if (fresh.length) {
        count(rec, 'gaps', fresh.length);
        emit(rec, 'IN', 'LOSS', `gap: #${uid} arrived before ${range(fresh[0], fresh[fresh.length - 1])} (${fresh.length} missing: lost or out of order)`, t);
      }
    }
    rec.seen.add(uid);
    while (rec.seen.has(rec.contig + 1)) { rec.contig++; rec.seen.delete(rec.contig); }
  }
}

// Calls fn without ever letting the recorder break the game.
let recorderErrors = 0;
function safe(fn) {
  try { fn(); } catch (e) { if (recorderErrors++ < 3) console.warn('[pb2dev] network log:', e); }
}

function wrap(obj, key, make) {
  if (!obj) return;
  const cur = obj[key];
  if (typeof cur !== 'function' || cur[WRAP]) return;
  const w = make(cur);
  w[WRAP] = { own: Object.hasOwn(obj, key) ? cur : null };
  obj[key] = w;
}
function unwrap(obj, key) {
  if (!obj || !Object.hasOwn(obj, key)) return;
  const cur = obj[key];
  if (!cur || !cur[WRAP]) return;
  if (cur[WRAP].own) obj[key] = cur[WRAP].own;
  else delete obj[key];
}

const socketOf = (c) => c.socket || null;
const isConnected = (c) => {
  const s = socketOf(c);
  const p = game.connPeer(c);
  return !!((s && s.connected) || (p && p.connected));
};
function kindOf(c) {
  if (c === game.lobbyConnection()) return 'server';
  if (c === game.p2pConnection()) return 'p2p-host';
  if (game.connPeer(c)) return 'p2p-guest';
  return 'socket';
}
function transportOf(c) {
  const s = socketOf(c);
  if (s) {
    let name = '';
    try { name = s.io.engine.transport.name; } catch {}
    return `socket.io${name ? ` over ${name}` : ''}`;
  }
  return 'peer-to-peer data channel (unordered, no retransmits)';
}

// Wraps what is not wrapped yet: the socket or peer can come later than the connection.
function wrapAll(rec) {
  const c = rec.conn;
  wrap(c, game.recvMethodName(), (orig) => function (text) {
    if (typeof text === 'string') safe(() => onIn(rec, text));
    return orig.apply(this, arguments);
  });
  const s = socketOf(c);
  if (s && s !== rec.socket) {
    if (rec.socket) unwrap(rec.socket, 'emit');
    rec.socket = s;
    wrap(s, 'emit', (orig) => function (event, data) {
      if (event === SOCKET_EVENT && typeof data === 'string') {
        let dropped = false;
        try { dropped = !!(this.flags && this.flags.volatile) && !(this.io && this.io.engine && this.io.engine.transport && this.io.engine.transport.writable); } catch {}
        safe(() => onOut(rec, data, dropped));
      }
      return orig.apply(this, arguments);
    });
  }
  const p = game.connPeer(c);
  if (p && p !== rec.peer) {
    if (rec.peer) unwrap(rec.peer, 'send');
    rec.peer = p;
    wrap(p, 'send', (orig) => function (data) {
      if (typeof data === 'string') safe(() => onOut(rec, data, false));
      return orig.apply(this, arguments);
    });
  }
}
function unwrapAll(rec) {
  unwrap(rec.conn, game.recvMethodName());
  unwrap(rec.socket, 'emit');
  unwrap(rec.peer, 'send');
}

function attach(c) {
  const connected = isConnected(c);
  const rec = {
    id: nextId++, conn: c, kind: kindOf(c), socket: null, peer: null, connected,
    maxOut: -1, ackOut: null, unacked: new Map(),
    contig: connected ? null : -1, seen: new Set(), missing: new Map(),
    sec: newCounts(), total: newCounts(), opened: Date.now(),
  };
  recs.set(c, rec);
  wrapAll(rec);
  emit(rec, '---', 'CONN', connected ? `already connected when recording started (${transportOf(c)})` : `new connection (${transportOf(c)})`);
  return rec;
}

function detach(rec, why) {
  unwrapAll(rec);
  recs.delete(rec.conn);
  if (why) emit(rec, '---', 'CONN', why);
}

const lossText = (n) => {
  const parts = [[n.resends, 'resend'], [n.dropped, 'dropped'], [n.gaps, 'gap'], [n.late, 'late'], [n.dups, 'duplicate']]
    .filter(([v]) => v).map(([v, w]) => (w === 'dropped' || w === 'late' ? `${v} ${w}` : plural(v, w)));
  return parts.length ? parts.join(', ') : 'none';
};
export const pingText = (c) => (typeof c.ping !== 'number' ? '?' : c.ping >= PING_NONE ? 'none yet' : `${c.ping} ms`);

function statLines(t) {
  for (const rec of recs.values()) {
    const n = rec.sec;
    if (n.pkIn || n.pkOut) {
      emit(rec, '---', 'STAT', `ping ${pingText(rec.conn)} | out ${plural(n.pkOut, 'packet')} ${kb(n.bytesOut)} (${n.relOut} reliable, ${n.stateOut} state)`
        + ` | in ${plural(n.pkIn, 'packet')} ${kb(n.bytesIn)} (${n.relIn} reliable, ${n.stateIn} state) | loss: ${lossText(n)}`
        + `${rec.unacked.size ? ` | ${rec.unacked.size} waiting for ack` : ''}${rec.missing.size ? ` | ${rec.missing.size} missing` : ''}`, t);
    }
    rec.sec = newCounts();
  }
}

function setOn(want) {
  on = want;
  if (want) {
    emit(null, '---', 'PAGE', started ? 'recording on (net_log on)' : `page loaded, game ${game.namesVersion() || '?'}, recording on`);
  } else {
    for (const rec of [...recs.values()]) detach(rec, 'not recorded any more');
    emit(null, '---', 'PAGE', 'recording off (net_log off)');
    flush();
  }
  started = true;
}

// Sends the waiting lines to the wrapper. Without it (tests, a plain browser) they only
// stay in this page's buffer.
function flush(beacon = false) {
  if (!pending.length || (flushing && !beacon)) return;
  const batch = pending;
  pending = [];
  lastFlush = Date.now();
  const body = JSON.stringify(batch);
  if (beacon && typeof navigator !== 'undefined' && navigator.sendBeacon) { navigator.sendBeacon(ROUTE.netLog, body); return; }
  flushing = true;
  Promise.resolve()
    .then(() => fetch(ROUTE.netLog, { method: 'POST', body }))
    .then(async (r) => {
      if (!r.ok) throw new Error(await r.text());
      const j = await r.json();
      file = j.file;
      run = j.run;
      writeError = null;
    })
    .catch((e) => { writeError = (e && e.message) || String(e); })
    .finally(() => { flushing = false; });
}

// Lines still waiting when the page goes away (a reload, the anti-cheat's too) go out
// with a beacon. The game's own addEventListener is the stage's, so the window's
// original is used.
function onPageHide() { flush(true); }
let hideHooked = false;
function hookPageHide() {
  if (hideHooked) return;
  hideHooked = true;
  try {
    if (typeof window !== 'undefined' && typeof EventTarget !== 'undefined') EventTarget.prototype.addEventListener.call(window, 'pagehide', onPageHide);
  } catch {}
}

// Every NET_TICK_MS (index.js): follows net_log, finds new and closed connections, writes
// the STAT lines and sends the lines to the wrapper.
export function netTick(t = Date.now()) {
  const want = settings.effective(KEY.NET_LOG) === true;
  if (want !== on || !started) setOn(want);
  if (on) {
    hookPageHide();
    const conns = game.connections();
    for (const c of conns) if (c && !recs.has(c)) attach(c);
    for (const rec of [...recs.values()]) {
      const c = rec.conn;
      if (!conns.includes(c)) {
        const n = rec.total;
        detach(rec, `closed: ${game.connReason(c) || 'no reason given'} | after ${((t - rec.opened) / 1000).toFixed(1)} s: `
          + `out ${n.pkOut} packets ${kb(n.bytesOut)}, in ${n.pkIn} packets ${kb(n.bytesIn)} | loss: ${lossText(n)}`);
        continue;
      }
      if (rec.kind === 'socket') rec.kind = kindOf(c); // set right after it is made
      wrapAll(rec);
      const now = isConnected(c);
      if (now !== rec.connected) {
        rec.connected = now;
        emit(rec, '---', 'CONN', now ? `connected (${transportOf(c)})` : 'connection interrupted');
      }
    }
    if (t - lastStat >= STAT_MS) { lastStat = t; statLines(t); }
  }
  if (t - lastFlush >= FLUSH_MS) flush();
}

// For "netlog".
export const netlog = {
  on: () => on,
  lines: () => lines,
  pageLines: () => pageLines,
  file: () => file,
  run: () => run,
  writeError: () => writeError,
  connections: () => [...recs.values()].map((r) => ({
    id: r.id, kind: r.kind, connected: r.connected, ping: pingText(r.conn), total: { ...r.total },
    unacked: r.unacked.size, missing: r.missing.size,
  })),
  lossText,
};

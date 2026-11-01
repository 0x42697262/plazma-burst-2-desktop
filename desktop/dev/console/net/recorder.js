// Network recorder: every packet on the game's connections, as readable lines. The lines
// go to the desktop wrapper, which writes them to netlogs/<run>_<instance>.log
// (desktop/netlog.js); "netlog" shows them. Console key net_log (on by default) turns it
// on and off, net_log_state adds every unreliable state update (decoded by position,
// net/state.js), net_log_all every packet (PKT lines) and every state update.
//
// The game's protocol (scripts/connection.js; docs/research/anticheat.md §13.3): a packet is text,
// fields split by \x01 (escaped "$.1" inside a field):
//   ack | latest unreliable state | uid | reliable message | uid | reliable message ...
// - ack: the highest reliable sequence number (uid) received in order.
// - state: one unreliable message, the newest; an unsent older one is replaced.
// - reliable messages: numbered 0, 1, 2 ... per connection. Every packet repeats every
//   message not acknowledged yet: each packet received resets what was sent to its ack, so
//   a message goes out again with each packet (every 16 ms) until its ack arrives, about one
//   round trip later. That repeating is normal, not loss. Parts are split by
//   \x02 (escaped "$.2"); part 0 is its type, an encoded number (net type names map it to
//   "RELIABLE_...").
// - numbers inside messages are written in base N with the game's digits: the characters
//   1-126 except a few, so they look like control characters and punctuation.
// Packets go over a socket.io socket, sent "volatile" (dropped when the socket is busy),
// or a peer-to-peer data channel (unordered, never retransmitted).
//
// What counts as packet loss here (repeats are only counted, in STAT):
//   slow ack   a message acknowledged more than SLOW_ACK_MS after the ping: the packets
//              carrying it (or the acks) were lost or held up
//   no ack     a message still not acknowledged after STALL_MS: nothing gets through
//   dropped    socket.io dropped a packet before sending it (the socket was busy)
//   gap        a reliable message arrived before an earlier one: lost or out of order
//   late       a message from a gap arrived (with how long it took)
// Unreliable state updates have no number, so their loss cannot be seen one by one; the
// STAT line counts them per second.
//
// How: the connection's receive method (through net/tap.js, shared with the fingerprinter
// capture), its socket's emit and its peer's send are wrapped on each connection object,
// only while net_log is on. Nothing global or on the network
// class is replaced (those are what the anti-tamper scan compares, docs/research/anticheat.md §6).
import { game } from '../game/bindings.js';
import { KEY } from '../state/schema.js';
import { settings } from '../state/store.js';
import { ROUTE } from '../core/shared.js';
import { FIELD, PART, unescField, splitParts, decodeNumber, showPart } from './codec.js';
import { describeState } from './state.js';
import { tap, untap } from './tap.js';

export { decodeNumber, showPart };
const SOCKET_EVENT = 'm'; // the game's one socket.io event, both ways
const WRAP = Symbol('pb2dev netlog wrapper');
const TAP_OWNER = 'netlog';

export const NET_TICK_MS = 50;
const FLUSH_MS = 500;
const STAT_MS = 1000;
const BUFFER_MAX = 5000; // this page's lines, for "netlog show" without the wrapper
const PENDING_MAX = 20000; // lines waiting for the wrapper
const CONN_WIDTH = 13;
const PING_NONE = 9999; // the game's ping with no samples
const PING_UNKNOWN_MS = 1000; // assumed while the game has no ping yet
const SLOW_ACK_MS = 500; // an ack this much later than the ping is a loss
const STALL_MS = 2000; // no ack for this long: said once per message

let now = () => Date.now();
// Tests: a clock they move themselves.
export const setClock = (fn) => { now = fn || (() => Date.now()); };

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
const TYPE_PREFIX = 'RELIABLE_'; // every reliable type name starts with it; left out
// Parts that are always an encoded number, even when it looks like a letter (values 29 to
// 121 are one ordinary character): (index, part count) => true. The callback ID a RESPONSE
// answers (the counter starts at 100), and every part of the messages that carry HP or the
// respawn count (docs/research/anticheat.md §14.9). HIT_PLAYER from the server has one more part at the
// end, its kill flag ("1" or ""), which stays text.
const ALL = () => true;
const HIT_PLAYER_SENT = 15; // parts as the shooter sends them (type + 14 numbers)
const NUMBER_PARTS = Object.freeze({
  RESPONSE: (i) => i === 1,
  RESPAWN: ALL, // (x, y, hp); from the server (slot, x, y, hp, respawn count)
  RESSURECT: ALL,
  HEAL_PLAYER: ALL, // (power x 100, healer, target, target's respawn count); from the server the sender's slot first
  HIT_PLAYER: (i, n) => n <= HIT_PLAYER_SENT || i < n - 1,
});

// A packet: { ack, state, stateSize, rel: [{ uid, data, size }] }. Sizes are as sent, so
// the packet's length is their sum plus the framing (ack, sequence numbers, separators).
export function parsePacket(text) {
  const raw = text.split(FIELD);
  const f = raw.map(unescField);
  const rel = [];
  for (let i = 2; i + 1 < f.length; i += 2) rel.push({ uid: parseInt(f[i], 10), data: f[i + 1], size: raw[i + 1].length });
  return { ack: parseInt(f[0], 10), state: f[1] || '', stateSize: (raw[1] || '').length, rel };
}

// A reliable message: { name, text }: name is its type without RELIABLE_ ("CHAT"), text is
// 'CHAT("hello", 7)'. whole: no part is cut (showPart).
export function describeMessage(data, digits, typeName, whole = false) {
  const parts = splitParts(data);
  const type = decodeNumber(parts[0], digits);
  const full = type !== null ? typeName(type) : null;
  const name = full ? full.replace(TYPE_PREFIX, '') : `TYPE_${type !== null ? type : '?'}`;
  const isNumber = NUMBER_PARTS[name] || (() => false);
  const args = parts.slice(1).map((p, i) => showPart(p, digits, isNumber(i + 1, parts.length), whole)).join(', ');
  return { name, parts, text: `${name}(${args})` };
}

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

const newCounts = () => ({
  pkOut: 0, bytesOut: 0, pkIn: 0, bytesIn: 0, relOut: 0, relIn: 0, stateOut: 0, stateIn: 0,
  repeatsOut: 0, repeatsIn: 0, acked: 0, ackMs: 0, slow: 0, stalled: 0, dropped: 0, gaps: 0, late: 0,
});

function emit(rec, dir, kind, text, t = now()) {
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
const layoutNow = () => { try { return game.stateLayout(); } catch { return null; } };

// What a state on this connection is (net/state.js): a client sends its player's state and
// gets the server's snapshot; a P2P host (p2p-guest connections) the other way round.
function stateKind(rec, dir) {
  const client = rec.kind === 'server' || rec.kind === 'p2p-host';
  const host = rec.kind === 'p2p-guest';
  if (!client && !host) return null;
  return (dir === 'OUT') === client ? 'player' : 'snapshot';
}

// A RESPONSE answers a request by its callback ID: the request had that ID, encoded, as
// one of its parts (where the game put its callback placeholder). Requests are matched
// newest first, each answered once. Kept: the last REQUESTS_KEPT messages each way.
const REQUESTS_KEPT = 300;
const RESPONSE = 'RESPONSE';
function remember(list, uid, m, t) {
  if (m.name === RESPONSE) return;
  list.push({ uid, name: m.name, parts: m.parts, t, answered: false });
  if (list.length > REQUESTS_KEPT) list.splice(0, list.length - REQUESTS_KEPT);
}
// "  <- answers #0 AUTHENTICATE (its "h" was callback ID 100), 320 ms later", or ''.
function answerOf(list, m, t) {
  if (m.name !== RESPONSE || m.parts.length < 2) return '';
  const id = m.parts[1];
  for (let i = list.length - 1; i >= 0; i--) {
    const q = list[i];
    const at = q.parts.indexOf(id, 1);
    if (q.answered || at < 1) continue;
    q.answered = true;
    const n = decodeNumber(id, digitsNow());
    return `  <- answers #${q.uid} ${q.name} (its part ${at}, ${JSON.stringify(id)}, was callback ID ${n === null ? '?' : n}), ${t - q.t} ms later`;
  }
  return '';
}

const pingMs = (c) => (typeof c.ping === 'number' && c.ping < PING_NONE ? c.ping : PING_UNKNOWN_MS);

// One of our messages was acknowledged: how long it took, and a LOSS line when that was
// far over the ping.
function acked(rec, uid, sent, t) {
  const took = t - sent.t;
  count(rec, 'acked');
  count(rec, 'ackMs', took);
  const ping = pingMs(rec.conn);
  if (took <= ping + SLOW_ACK_MS) return;
  count(rec, 'slow');
  emit(rec, 'OUT', 'LOSS', `slow ack: #${uid} ${sent.name} acknowledged after ${took} ms, ping ${ping} ms (sent ${plural(sent.tries, 'time')}): packets or acks were lost on the way`, t);
}

// Messages with no ack for STALL_MS: said once each.
function stallCheck(rec, t) {
  for (const [uid, sent] of rec.unacked) {
    if (sent.stalled || t - sent.t < STALL_MS) continue;
    sent.stalled = true;
    count(rec, 'stalled');
    emit(rec, 'OUT', 'LOSS', `no ack: #${uid} ${sent.name} not acknowledged after ${t - sent.t} ms (sent ${plural(sent.tries, 'time')}): nothing is getting through`, t);
  }
}

// net_log_all: one line per packet, before what it carries (the REL and STATE lines
// after it show the contents).
function packetLine(rec, dir, text, p, t) {
  const digits = digitsNow();
  const ack = Number.isNaN(p.ack) || p.ack < 0 ? 'ack none' : `ack #${p.ack}`;
  const what = [];
  let used = 0;
  if (p.state) { what.push(`state (${plural(p.state.split(PART).length, 'part')}) ${p.stateSize} chars`); used += p.stateSize; }
  for (const { uid, data, size } of p.rel) { what.push(`#${uid} ${describeMessage(data, digits, typeNameNow).name} ${size} chars`); used += size; }
  // What is left: the ack, the sequence numbers and the separators between the fields.
  emit(rec, dir, 'PKT', `${text.length} chars | ${ack} | ${what.length ? `${what.join(', ')} | framing ${text.length - used} chars` : 'nothing else'}`, t);
}

function onOut(rec, text, dropped, t = now()) {
  count(rec, 'pkOut');
  count(rec, 'bytesOut', text.length);
  const p = parsePacket(text);
  const digits = digitsNow();
  if (allOn()) packetLine(rec, 'OUT', text, p, t);
  if (!Number.isNaN(p.ack)) rec.ackOut = p.ack;
  if (p.state) {
    count(rec, 'stateOut');
    if (stateOn()) emit(rec, 'OUT', 'STATE', describeState(p.state, digits, stateKind(rec, 'OUT'), layoutNow()), t);
  }
  for (const { uid, data } of p.rel) {
    if (Number.isNaN(uid)) continue;
    const sent = rec.unacked.get(uid);
    if (uid > rec.maxOut) {
      rec.maxOut = uid;
      const m = describeMessage(data, digits, typeNameNow, allOn());
      rec.unacked.set(uid, { t, tries: 1, name: m.name, stalled: false });
      count(rec, 'relOut');
      emit(rec, 'OUT', 'REL', `#${uid} ${m.text}${answerOf(rec.asked.IN, m, t)}`, t);
      remember(rec.asked.OUT, uid, m, t);
    } else {
      // Repeated until acknowledged: normal (see the top of this file).
      count(rec, 'repeatsOut');
      if (sent) sent.tries++;
    }
  }
  if (dropped) {
    count(rec, 'dropped');
    emit(rec, 'OUT', 'LOSS', `dropped: the socket was busy, socket.io did not send this packet (${plural(p.rel.length, 'reliable message')}, sent again later${p.state ? '; its state update is lost' : ''})`, t);
  }
}

function onIn(rec, text, t = now()) {
  count(rec, 'pkIn');
  count(rec, 'bytesIn', text.length);
  const p = parsePacket(text);
  const digits = digitsNow();
  if (allOn()) packetLine(rec, 'IN', text, p, t);
  // Their ack: our messages up to it arrived.
  if (!Number.isNaN(p.ack)) {
    for (const [uid, sent] of rec.unacked) {
      if (uid > p.ack) continue;
      rec.unacked.delete(uid);
      acked(rec, uid, sent, t);
    }
  }
  if (p.state) {
    count(rec, 'stateIn');
    if (stateOn()) emit(rec, 'IN', 'STATE', describeState(p.state, digits, stateKind(rec, 'IN'), layoutNow()), t);
  }
  const uids = p.rel.map((r) => r.uid).filter((u) => !Number.isNaN(u));
  // Recording started while the connection was already busy: start counting here.
  if (rec.contig === null && uids.length) rec.contig = Math.min(...uids) - 1;
  for (const { uid, data } of p.rel) {
    if (Number.isNaN(uid)) continue;
    if (uid <= rec.contig || rec.seen.has(uid)) {
      count(rec, 'repeatsIn'); // the other side repeats it until our ack arrives: normal
      continue;
    }
    count(rec, 'relIn');
    const m = describeMessage(data, digits, typeNameNow, allOn());
    emit(rec, 'IN', 'REL', `#${uid} ${m.text}${answerOf(rec.asked.OUT, m, t)}`, t);
    remember(rec.asked.IN, uid, m, t);
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
  tap(c, game.recvMethodName(), TAP_OWNER, (text) => {
    if (typeof text === 'string') safe(() => onIn(rec, text));
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
  untap(rec.conn, game.recvMethodName(), TAP_OWNER);
  unwrap(rec.socket, 'emit');
  unwrap(rec.peer, 'send');
}

function attach(c) {
  const connected = isConnected(c);
  const rec = {
    id: nextId++, conn: c, kind: kindOf(c), socket: null, peer: null, connected,
    maxOut: -1, ackOut: null, unacked: new Map(), asked: { OUT: [], IN: [] },
    contig: connected ? null : -1, seen: new Set(), missing: new Map(),
    sec: newCounts(), total: newCounts(), opened: now(),
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
  const parts = [[n.slow, 'slow ack', 's'], [n.stalled, 'no ack', ''], [n.dropped, 'dropped', ''], [n.gaps, 'gap', 's'], [n.late, 'late', '']]
    .filter(([v]) => v).map(([v, w, s]) => `${v} ${w}${v === 1 ? '' : s}`);
  return parts.length ? parts.join(', ') : 'none';
};
// Messages sent again (and received again) until acknowledged: normal, how many per second.
const repeatText = (n) => `repeated ${n.repeatsOut} out, ${n.repeatsIn} in`;
const ackText = (n) => (n.acked ? ` | acks in ${Math.round(n.ackMs / n.acked)} ms` : '');

// socket.io's reasons for a closed connection, in words.
const CLOSE_REASONS = Object.freeze({
  'io server disconnect': 'the server closed the connection on purpose',
  'io client disconnect': 'this game closed the connection',
  'ping timeout': 'the server stopped answering socket.io\'s heartbeat',
  'transport close': 'the connection was cut (the network, or the server went away)',
  'transport error': 'the connection failed',
  'parse error': 'the server sent something socket.io could not read',
});
const reasonText = (r) => {
  if (!r) return 'no reason given';
  const known = Object.entries(CLOSE_REASONS).find(([k]) => String(r).startsWith(k));
  return known ? `${r} (${known[1]})` : r;
};
export const pingText = (c) => (typeof c.ping !== 'number' ? '?' : c.ping >= PING_NONE ? 'none yet' : `${c.ping} ms`);

function statLines(t) {
  for (const rec of recs.values()) {
    const n = rec.sec;
    if (n.pkIn || n.pkOut) {
      emit(rec, '---', 'STAT', `ping ${pingText(rec.conn)}${ackText(n)} | out ${plural(n.pkOut, 'packet')} ${kb(n.bytesOut)} (${n.relOut} reliable, ${n.stateOut} state)`
        + ` | in ${plural(n.pkIn, 'packet')} ${kb(n.bytesIn)} (${n.relIn} reliable, ${n.stateIn} state) | ${repeatText(n)} | loss: ${lossText(n)}`
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
  lastFlush = now();
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
export function netTick(t = now()) {
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
        detach(rec, `closed: ${reasonText(game.connReason(c))} | after ${((t - rec.opened) / 1000).toFixed(1)} s: `
          + `out ${n.pkOut} packets ${kb(n.bytesOut)}, in ${n.pkIn} packets ${kb(n.bytesIn)}${ackText(n)} | loss: ${lossText(n)}`);
        continue;
      }
      if (rec.kind === 'socket') rec.kind = kindOf(c); // set right after it is made
      wrapAll(rec);
      const up = isConnected(c);
      if (up !== rec.connected) {
        rec.connected = up;
        emit(rec, '---', 'CONN', up ? `connected (${transportOf(c)})` : 'connection interrupted');
      }
      stallCheck(rec, t);
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

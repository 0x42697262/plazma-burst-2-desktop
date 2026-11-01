// The main server's browser fingerprinter (FINGERPRINTING.md): it arrives on the lobby
// connection as a RELIABLE_TASK (or RELIABLE_TASK_ASNYC, the game's spelling) whose first
// part is JavaScript source, which the game runs with eval and answers with what it
// returns. Every one seen goes to the desktop wrapper, which keeps each version once in
// fingerprint/ (desktop/fingerprint.js); "fingerprint" runs the latest.
//
// How: the lobby connection's receive method is tapped (net/tap.js, shared with the
// network recorder), whatever net_log is. A packet is only looked into when its text has
// MARKER in it, so the rest cost one search. The game sends a message again in every
// packet until its ack arrives, so the same source is sent to the wrapper once.
import { print, TAG } from '../ui/log.js';
import { COLOR } from '../core/colors.js';
import { ROUTE } from '../core/shared.js';
import { REMOTE } from '../core/remote.js';
import { game } from '../game/bindings.js';
import { FIELD, unescField, splitParts, decodeNumber } from './codec.js';
import { tap, untap } from './tap.js';

export const MARKER = 'getBrowserFingerprint'; // the fingerprinter's method (get-browser-fingerprint)
export const TASK_KIND = Object.freeze({ RELIABLE_TASK: 'sync', RELIABLE_TASK_ASNYC: 'async' });
const TAP_OWNER = 'fingerprint';

let tapped = null; // the lobby connection listened to
let lastCode = null; // the source last sent to the wrapper

// The fingerprinter tasks in one raw packet: [{ code, kind }].
export function findTasks(text, digits, typeName) {
  if (typeof text !== 'string' || !text.includes(MARKER)) return [];
  const fields = text.split(FIELD).map(unescField);
  const found = [];
  // ack | state | uid | message | uid | message ...
  for (let i = 3; i < fields.length; i += 2) {
    const parts = splitParts(fields[i]);
    const type = decodeNumber(parts[0], digits);
    const kind = type !== null ? TASK_KIND[typeName(type)] : undefined;
    if (kind && typeof parts[1] === 'string' && parts[1].includes(MARKER)) found.push({ code: parts[1], kind });
  }
  return found;
}

function send({ code, kind }) {
  if (code === lastCode) return;
  lastCode = code;
  fetch(`${ROUTE.fingerprint}?kind=${kind}`, { method: 'POST', body: code })
    .then(async (r) => {
      if (!r.ok) throw new Error(await r.text());
      const saved = await r.json();
      if (saved.status === 'new') print(`The server sent a new fingerprinter (version ${saved.id}): saved to ${saved.file}. "fingerprint" runs it.`, COLOR.hint);
    })
    .catch((e) => console.warn(`${TAG} fingerprinter not saved: ${e.message}`));
}

function onPacket(text) {
  let digits = '';
  try { digits = game.netDigits(); } catch {}
  const typeName = (t) => { try { return game.netTypeName(t); } catch { return null; } };
  for (const task of findTasks(text, digits, typeName)) send(task);
}

// Every NET_TICK_MS (index.js): follows the lobby connection, which is made again on
// each reconnect.
export function fingerprintTick() {
  if (REMOTE) return;
  const conn = game.lobbyConnection() || null;
  const key = game.recvMethodName();
  if (tapped && tapped !== conn) untap(tapped, key, TAP_OWNER);
  tapped = conn;
  tap(conn, key, TAP_OWNER, onPacket);
}

// State updates, readable (ANTICHEAT.md §14.2 and §14.9). Two kinds go over a connection:
//
// - A player's state: what a client sends about its own character about 60 times a
//   second (flash.js $ММ.$ТеeАp), and what a P2P host gets from each guest. Decoded by
//   position into labelled values: "hp 150 | respawns 1 | aim +212,-40 | ...".
// - The server's snapshot: what the server sends a client, with every player whose state
//   changed: slot, the server's copy of their HP, ping~skill~reputation, then their state
//   (HP blanked by the server). Decoded as "#3 hp 80 ping 45 [pos ... | aim ...]".
//
// Game versions: the positions the server reads (HP, respawn count, aim, head and face
// HP, position, killer, clock) are numbers on the game's network class, found by
// "npm run find-names" (stateHp, stateRespawns, ...) and read from the game here, so they
// follow a new layout by themselves. The other positions are this version's layout
// (KNOWN): they are only used while the game's own positions still match it and the part
// count is right. Otherwise those parts are shown as p<index>, decoded as well as can be.
// A snapshot that does not parse as expected is shown part by part instead.
import { splitParts, decodeNumber, showPart } from './codec.js';

// This version's layout (v1769098419): the positions the server reads...
const KNOWN = Object.freeze({ x: 1, y: 2, hp: 6, aimX: 7, aimY: 8, headHp: 12, faceHp: 13, killer: 16, clock: 19, respawns: 20 });
const KNOWN_PARTS = 21;
// ...and the rest, which only the sending code shows (flash.js $ТеeАp).
const EXTRA = Object.freeze({
  bodyControl: 0, // percent, "" = 100 (standing); under 100 the limp body's points follow in `points`
  vx: 3, vy: 4, // velocity times the velocity multiplier
  points: 5, // limp body points: 4 numbers each (dx, dy, vx, vy), joined by "~"
  flags: 9, // bit mask: weapon slots not ready, then 5 action flags
  gun: 10, // the held gun's network id, "" = none
  vehicle: 11, // vehicle index, "" = on foot
  armsHp: 14, legsHp: 15,
  marks: 17, // "1" knocked down, "2" a second flag, "3" both, "" none
  shots: 18, // projectiles in flight: 7 numbers each, joined by "~"
});
const POINT_SIZE = 4;
const SHOT_SIZE = 7;
const KNOCKED_DOWN = new Set(['1', '3']);
const OTHER_MARK = new Set(['2', '3']);

const sign = (n) => (n > 0 ? `+${n}` : String(n));
const round2 = (n) => Math.round(n * 100) / 100;

// layout: game.stateLayout() ({ hp: 6, ... } with null for a missing name).
export function describePlayerState(parts, digits, layout = {}) {
  const lay = layout || {};
  const num = (i) => (i === null || i === undefined ? null : decodeNumber(parts[i], digits));
  const blank = (i) => i !== null && i !== undefined && parts[i] === '';
  const used = new Set();
  const use = (i) => { if (i !== null && i !== undefined) used.add(i); return i; };
  const out = [];

  const hpAt = use(lay.hp);
  const hp = num(hpAt);
  if (hpAt !== null && hpAt !== undefined) out.push(blank(hpAt) ? 'hp -' : `hp ${hp ?? '?'}`);
  const respawns = num(use(lay.respawns));
  if (respawns !== null) out.push(`respawns ${respawns}`);
  const ax = num(use(lay.aimX));
  const ay = num(use(lay.aimY));
  if (ax !== null || ay !== null) out.push(`aim ${sign(ax ?? 0)},${sign(ay ?? 0)}`);
  const x = num(use(lay.x));
  const y = num(use(lay.y));
  if (x !== null || y !== null) out.push(`pos ${x ?? '?'},${y ?? '?'}`);

  const full = parts.length === KNOWN_PARTS && Object.entries(KNOWN).every(([k, i]) => lay[k] === i);
  const head = num(use(lay.headHp));
  const face = num(use(lay.faceHp));
  if (full) {
    const scale = lay.velScale || 1;
    out.push(`vel ${round2((num(use(EXTRA.vx)) ?? 0) / scale)},${round2((num(use(EXTRA.vy)) ?? 0) / scale)}`);
    out.push(`body hp: head ${head ?? '?'} face ${face ?? '?'} arms ${num(use(EXTRA.armsHp)) ?? '?'} legs ${num(use(EXTRA.legsHp)) ?? '?'}`);
  } else if (head !== null || face !== null) {
    out.push(`head hp ${head ?? '?'}, face hp ${face ?? '?'}`);
  }
  // Alive: how far crouched; dead: who killed you. A relayed state has no HP to tell.
  const k = num(use(lay.killer));
  if (k !== null) out.push(hp !== null && hp <= 0 ? `killed by ${k}` : hp === null ? `crouch/killer ${k}` : `crouch ${k}`);
  if (full) {
    const marks = parts[use(EXTRA.marks)];
    if (KNOCKED_DOWN.has(marks)) out.push('knocked down');
    if (OTHER_MARK.has(marks)) out.push('mark 2');
    const gun = num(use(EXTRA.gun));
    out.push(gun === null ? 'no gun' : `gun ${gun}`);
    const vehicle = num(use(EXTRA.vehicle));
    if (vehicle !== null) out.push(`vehicle ${vehicle}`);
    const control = num(use(EXTRA.bodyControl));
    const points = parts[use(EXTRA.points)];
    if (control !== null) {
      const nums = points ? points.split('~').map((p) => decodeNumber(p, digits) ?? 0) : [];
      const groups = [];
      for (let i = 0; i + POINT_SIZE <= nums.length; i += POINT_SIZE) groups.push(nums.slice(i, i + POINT_SIZE).join(','));
      out.push(`limp ${control}%${groups.length ? ` (${groups.length} body points: ${groups.join(' ')})` : ''}`);
    }
    const flags = num(use(EXTRA.flags));
    if (flags) out.push(`flags ${flags.toString(2)}`);
    const shots = parts[use(EXTRA.shots)];
    if (shots) out.push(`${Math.floor(shots.split('~').length / SHOT_SIZE)} projectiles`);
  }
  const clock = num(use(lay.clock));
  if (clock !== null) out.push(`clock ${(clock / 1000).toFixed(3)} s`);
  // Anything this layout does not name.
  const rest = [];
  parts.forEach((p, i) => { if (!used.has(i) && p !== '') rest.push(`p${i} ${showPart(p, digits)}`); });
  if (!full) rest.unshift(`(${parts.length} parts; not this version's layout: only the server's positions are named)`);
  if (rest.length) out.push(rest.join(', '));
  return out.join(' | ');
}

// The server's snapshot, or null when it does not parse as one (then it is shown part by
// part). Header: "~~" waiting (not in sync yet), "~" paused, then the round timer in ms.
export function describeSnapshot(parts, digits, layout) {
  let ptr = 0;
  const next = () => parts[ptr++];
  const head = next();
  if (head === undefined) return null;
  const flags = head.startsWith('~~') ? 'waiting' : head.startsWith('~') ? 'paused' : '';
  const timer = decodeNumber(head.replace(/^~~?/, ''), digits);
  const out = [];
  if (flags) out.push(flags);
  if (timer) out.push(`round timer ${(timer / 1000).toFixed(1)} s`);
  while (ptr < parts.length) {
    const slot = decodeNumber(next(), digits);
    const hpText = next();
    const hp = hpText === '' ? 0 : decodeNumber(hpText, digits);
    const stats = (next() ?? '').split('~').map((p) => (p === '' ? 0 : decodeNumber(p, digits)));
    const countText = next();
    const count = countText === '' ? 0 : decodeNumber(countText, digits);
    if (slot === null || hp === null || count === null || count < 0 || ptr + count > parts.length || stats.length !== 3 || stats.includes(null)) return null;
    const state = parts.slice(ptr, ptr + count);
    ptr += count;
    out.push(`#${slot} hp ${hp} ping ${stats[0]} ms${count ? ` [${describePlayerState(state, digits, layout)}]` : ''}`);
  }
  return out.length ? out.join(' | ') : 'nothing new';
}

// kind: 'player', 'snapshot', or null (not known: shown part by part).
export function describeState(data, digits, kind, layout) {
  const parts = splitParts(data);
  if (kind === 'player') return describePlayerState(parts, digits, layout);
  if (kind === 'snapshot') {
    const s = describeSnapshot(parts, digits, layout);
    if (s !== null) return s;
  }
  return `(${parts.map((p) => showPart(p, digits)).join(', ')})`;
}

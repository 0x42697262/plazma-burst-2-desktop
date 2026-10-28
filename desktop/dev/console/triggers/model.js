// Reading the map's triggers, regions and timers.
import { game } from '../game/bindings.js';
import { F } from '../game/fields.js';
import { ACTION, RUNS_REGION_TRIGGER } from '../game/actions.js';
import { parseIndex, quote } from '../core/text.js';
import { unwrap } from './log.js';

const TARGET_SHOWN = 40; // characters of a text target shown in lists

// Region activation modes, from the region check in frame2.js (team 12 = red, 13 = blue).
const REGION_MODES = Object.freeze({
  1: 'use key', 2: 'character enters', 3: 'vehicle enters', 4: 'anything enters',
  5: 'door/elevator arrives', 6: 'player enters', 7: 'all team players inside',
  9: 'use key, red team', 10: 'use key, blue team', 13: 'red player enters',
  14: 'blue player enters', 17: 'bot enters', 18: 'enemy bot enters',
});

const upTo = (arr, n) => (arr || []).slice(0, typeof n === 'number' ? n : (arr || []).length);

// Unwrapped, so the console's own reads are not logged as runs.
export const triggerList = () => upTo(game.triggers(), game.triggerCount()).map(unwrap);
export const regionList = () => upTo(game.regions(), game.regionCount());
export const timerList = () => upTo(game.timers(), game.timerCount());

// Every action of a trigger: { n (1-based), type, A, B }.
export function* actionsOf(t) {
  for (let a = 0; a < (t[F.T_ACTIONS] || 0); a++) {
    yield { n: a + 1, type: t[F.T_TYPES][a], A: t[F.T_A][a], B: t[F.T_B][a] };
  }
}

// Action targets are numbers (indexes, values) or text once the map has loaded.
export const showTarget = (v) => (v === undefined || v === null ? '-' : quote(v, TARGET_SHOWN));

export const callsText = (t) => (t[F.T_MAX_CALLS] === -1 ? 'unlimited' : `${t[F.T_CALLS]}/${t[F.T_MAX_CALLS]} left`);

export const triggerLabel = (idx, t) => `#${idx}${t.uid ? ' ' + t.uid : ''}`;

// A trigger by index ("12", "#12") or by uid ("#god_all"): its index, or -1.
export function findTrigger(list, q) {
  const idx = parseIndex(q);
  if (idx !== null) return idx;
  const lq = String(q).toLowerCase();
  return list.findIndex((t) => t && String(t.uid).toLowerCase() === lq);
}

// An action target as a trigger index: indexes stay, a "#uid" is looked up.
export function triggerIndex(v) {
  if (typeof v === 'number') return v;
  if (typeof v === 'string' && /^-?\d+$/.test(v)) return Number(v);
  if (typeof v === 'string' && v[0] === '#') return triggerList().findIndex((t) => t && t.uid === v);
  return -1;
}

// What starts each trigger: regions (by mode), timers, chat, deaths, other triggers.
// Returns Map(trigger index -> [description]).
export function triggerSources() {
  const src = new Map();
  const add = (t, what) => { if (typeof t === 'number' && t >= 0) (src.get(t) || src.set(t, []).get(t)).push(what); };
  const regions = regionList();
  regions.forEach((r, i) => {
    if (r && r[F.R_USE_ON]) add(r[F.R_TRIGGER], `region #${i} at ${Math.round(r.x)}, ${Math.round(r.y)} (${REGION_MODES[r[F.R_USE_ON]] || 'mode ' + r[F.R_USE_ON]})`);
  });
  timerList().forEach((t, i) => { if (t) add(t[F.TIMER_TARGET], `timer #${i}`); });
  add(game.sayTrigger(), 'chat message');
  const chars = game.chars() || [];
  for (let i = 0; i < (game.charCount() || 0); i++) {
    const c = chars[i];
    if (c) add(triggerIndex(c[F.ON_DEATH]), `death of #${i}${c.nickname ? ' ' + c.nickname : ''}`);
  }
  triggerList().forEach((t, i) => {
    if (!t) return;
    for (const { type, A } of actionsOf(t)) {
      const target = triggerIndex(A);
      if (type === ACTION.RUN_TRIGGER) add(target, `trigger #${i}`);
      else if (RUNS_REGION_TRIGGER.has(type) && regions[target]) add(regions[target][F.R_TRIGGER], `trigger #${i} (via region #${target})`);
    }
  });
  return src;
}

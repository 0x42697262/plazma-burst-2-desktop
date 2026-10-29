// Reading the map's triggers, regions and timers.
import { game } from '../game/bindings.js';
import { F } from '../game/fields.js';
import { ACTION, RUNS_REGION_TRIGGER } from '../game/actions.js';
import { parseIndex, quote } from '../core/text.js';
import { MAP } from '../core/shared.js';
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

// The uid of every region, timer and player, by index. The game keeps uids only on
// triggers, but its map loader numbers each kind in the order the map lists them, so
// the n-th <timer> in the map text is timer #n. Read once per map.
const UID_TAGS = Object.freeze(['region', 'timer', 'player']);
let uidsFor = null;
let uidsOf = { region: [], timer: [], player: [] };

function mapUids() {
  const text = game.mapText();
  if (text === uidsFor) return uidsOf;
  uidsFor = text;
  uidsOf = Object.fromEntries(UID_TAGS.map((tag) => [tag, []]));
  if (typeof text === 'string' && !text.startsWith(MAP.compressedPrefix)) {
    for (const m of text.matchAll(/<(region|timer|player)\b([^>]*)>/g)) {
      const uid = m[2].match(/\buid="([^"]*)"/);
      uidsOf[m[1]].push(uid ? uid[1] : undefined);
    }
  }
  return uidsOf;
}

// How a trigger gets run. "start" is not a source of its own in the map: it is the
// trigger's "runs at map start" flag, and sourcesOf adds it.
export const SOURCE = Object.freeze({
  REGION: 'region', TIMER: 'timer', CHAT: 'chat', DEATH: 'death', TRIGGER: 'trigger', START: 'start',
});

const named = (what, i, uid) => `${what} #${i}${uid ? ' ' + uid : ''}`;

// What starts each trigger: regions (by mode), timers, chat, deaths, other triggers.
// Returns Map(trigger index -> [{ kind, index, uid, text }]); index and uid are the
// region, timer, character or trigger that does it (undefined for chat).
export function triggerSources() {
  const src = new Map();
  const uids = mapUids();
  const add = (t, kind, index, uid, text) => {
    if (typeof t !== 'number' || t < 0) return;
    if (!src.has(t)) src.set(t, []);
    src.get(t).push({ kind, index, uid, text });
  };
  const regions = regionList();
  regions.forEach((r, i) => {
    if (!r || !r[F.R_USE_ON]) return;
    const mode = REGION_MODES[r[F.R_USE_ON]] || 'mode ' + r[F.R_USE_ON];
    add(r[F.R_TRIGGER], SOURCE.REGION, i, uids.region[i], `${named('region', i, uids.region[i])} at ${Math.round(r.x)}, ${Math.round(r.y)} (${mode})`);
  });
  timerList().forEach((t, i) => { if (t) add(t[F.TIMER_TARGET], SOURCE.TIMER, i, uids.timer[i], named('timer', i, uids.timer[i])); });
  add(game.sayTrigger(), SOURCE.CHAT, undefined, undefined, 'chat message');
  const chars = game.chars() || [];
  for (let i = 0; i < (game.charCount() || 0); i++) {
    const c = chars[i];
    if (c) add(triggerIndex(c[F.ON_DEATH]), SOURCE.DEATH, i, uids.player[i], `death of #${i}${c.nickname ? ' ' + c.nickname : ''}`);
  }
  triggerList().forEach((t, i) => {
    if (!t) return;
    const by = named('trigger', i, t.uid);
    for (const { type, A } of actionsOf(t)) {
      const target = triggerIndex(A);
      if (type === ACTION.RUN_TRIGGER) add(target, SOURCE.TRIGGER, i, t.uid, by);
      else if (type === ACTION.JUMP_TO_TRIGGER) add(target, SOURCE.TRIGGER, i, t.uid, `${by} (continues in it)`);
      else if (RUNS_REGION_TRIGGER.has(type) && regions[target]) add(regions[target][F.R_TRIGGER], SOURCE.TRIGGER, i, t.uid, `${by} (via region #${target})`);
    }
  });
  return src;
}

// Everything that runs trigger t (index i): its sources, plus map start.
export function sourcesOf(sources, i, t) {
  const list = sources.get(i) || [];
  return t[F.T_AT_START] ? [{ kind: SOURCE.START, text: 'map start' }, ...list] : list;
}

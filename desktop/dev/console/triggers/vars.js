// The map's trigger variables, and what a sync of one to the match would do.
// Triggers keep their state in one object, variable name -> value, emptied whenever a
// map loads. A value from the map went through the loader's own conversion: a whole
// number becomes a number, everything else stays text. The "variable equals" actions
// compare with ===, so that difference decides whether a gate fires.
import { game } from '../game/bindings.js';
import { F } from '../game/fields.js';
import { ACTION, VAR_WRITE_TYPES } from '../game/actions.js';
import { MAP } from '../core/shared.js';
import { quote, s } from '../core/text.js';
import { requireLevel } from '../game/level.js';
import { triggerList, actionsOf } from './model.js';

// The map's engine mark that allows syncing (an <inf mark="var_sync"> element).
const VAR_SYNC_MARK = 'mark="var_sync"';
export const VAR_MAX_LEN = 2048; // the game's own sync actions refuse a longer name or value

// Merge modes, as receivers apply them (scripts/libs/flash.js, scripts/frame2.js), each
// with the trigger action that sends it.
export const SYNC_MODES = Object.freeze({
  r: { type: ACTION.SYNC_REPLACE, what: 'replace', how: 'sets it on every client, whatever they had' },
  d: { type: ACTION.SYNC_DEFAULT, what: 'default', how: 'sets it only where it is unset or not a number' },
  x: { type: ACTION.SYNC_MAX, what: 'max', how: 'keeps the higher number, so it can only raise a value' },
  n: { type: ACTION.SYNC_MIN, what: 'min', how: 'keeps the lower number, so it can only lower a value' },
  l: { type: ACTION.SYNC_LONGEST, what: 'longest', how: 'sets it only where the new text is longer' },
});
export const RECOMMENDED_MODE = 'r';
const modeOfType = Object.freeze(Object.fromEntries(Object.entries(SYNC_MODES).map(([m, d]) => [d.type, m])));
// These re-send each client's own value with a merge that can undo yours.
const FIGHTING_MODES = new Set(['x', 'n']);
export const fights = (mode) => FIGHTING_MODES.has(mode);
export const modeName = (mode) => `${mode} (${SYNC_MODES[mode].what})`;

export function mapVars() {
  const v = game.mapVars();
  if (!v) throw new Error('no variables yet: they are created when a map loads');
  return v;
}

// The variables you changed with the console, per map load: name -> the value before
// your first change (undefined when it was not set).
const edits = new WeakMap();

export function noteVarEdit(vars, name, before) {
  if (!edits.has(vars)) edits.set(vars, new Map());
  const m = edits.get(vars);
  if (!m.has(name)) { if (before !== vars[name]) m.set(name, before); } else if (m.get(name) === vars[name]) m.delete(name); // back where it started
}

// [{ name, was, now }] for the map loaded now, sorted by name; empty without one.
export function editedVars() {
  const vars = game.mapVars();
  const m = vars && edits.get(vars);
  if (!m) return [];
  return [...m].map(([name, was]) => ({ name, was, now: vars[name] }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function requireVars() {
  requireLevel();
  return mapVars();
}

// Never shortened: for one value the user asked about.
export const showVar = (v) => (v === undefined ? '(not set)' : quote(v));

// The map loader's rule (its target fixup in scripts/frame2.js): a whole number becomes
// a number, anything else stays text. So 5 is the number 5, while 3.5, 01 and -0 stay
// text, as the map itself stores them. Double quotes force text: "5" is the text 5.
// Not copied: the loader also resolves a leading "#uid" to that object's index, which
// applies to a trigger's own action targets, not to a variable set here.
export function parseVarValue(raw) {
  if (raw.length >= 2 && raw.startsWith('"') && raw.endsWith('"')) return raw.slice(1, -1);
  const n = parseInt(raw, 10);
  return String(n) === raw ? n : raw;
}

// This client sends and applies syncs only with the mark. The game never sets it back to
// false, so it can still be on from an earlier map in the same session.
export const syncMarkOn = () => game.varSyncOn();

// Whether the map now loaded carries the mark: true, false, or null when its text is
// not readable (it is compressed until the level starts).
export function mapHasSyncMark() {
  const text = game.mapText();
  if (typeof text !== 'string' || !text || text.startsWith(MAP.compressedPrefix)) return null;
  return text.includes(VAR_SYNC_MARK);
}

// Every trigger action that syncs this variable: they re-send it after you.
export function syncActionsFor(name) {
  const out = [];
  triggerList().forEach((t, i) => {
    if (!t) return;
    for (const { n, type, A } of actionsOf(t)) {
      const mode = modeOfType[type];
      if (mode && String(A) === name) out.push({ idx: i, uid: t.uid, action: n, mode });
    }
  });
  return out;
}

// Triggers that write this variable and run only once or at map start: the map's own
// initialisers. A client that reloads the map runs them again with their calls reset,
// so it ends up with the map's value whatever was synced to it earlier.
export function seedersFor(name) {
  const out = [];
  triggerList().forEach((t, i) => {
    if (!t) return;
    const atStart = !!t[F.T_AT_START];
    const once = t[F.T_MAX_CALLS] === 1;
    if (!atStart && !once) return;
    for (const { n, type, A } of actionsOf(t)) {
      if (VAR_WRITE_TYPES.has(type) && String(A) === name) { out.push({ idx: i, uid: t.uid, action: n, atStart, once }); break; }
    }
  });
  return out;
}

export const NO = 'no';
export const YES = 'yes';

// Can this mode deliver this value? Returns [verdict, why].
export function modeVerdict(mode, value) {
  const numeric = !isNaN(parseFloat(value)) && isFinite(value);
  const notANumber = 'text is parsed as a number first, which gives NaN';
  switch (mode) {
    case 'r': return [YES, 'assigns it outright'];
    case 'd': return numeric
      ? [NO, 'the old value is a number, so it is kept']
      : [YES, 'any text counts as "not a number", so it is overwritten'];
    case 'x': return numeric ? ['raise only', 'clients holding a higher number keep theirs'] : [NO, notANumber];
    case 'n': return numeric ? ['lower only', 'clients holding a lower number keep theirs'] : [NO, notANumber];
    case 'l': {
      const n = String(value).length;
      return ['longer only', `only clients whose value is under ${n} character${s(n)}${numeric ? ', which compares a number as text' : ''}`];
    }
    default: return [NO, 'unknown mode'];
  }
}

// Running a trigger the way the game does: through its own runner, with the activator
// ("the player who started it", which many actions use) set first. Used by
// "triggers run" and "regions run".
// Without force the game's rules apply: the trigger must be enabled with calls left, and
// running uses up a call. With force it runs anyway, and its enabled state and calls left
// are put back afterwards.
// Multiplayer: the run is sent to the server like a normal one, so other players run it
// too. Not sent (your client only) when the other clients would refuse it or run it
// differently: forced, "as" another character (the server always makes the sender the
// activator), or while spectating.
import { print } from '../ui/log.js';
import { COLOR } from '../core/colors.js';
import { plural, parseIndex } from '../core/text.js';
import { game } from '../game/bindings.js';
import { F } from '../game/fields.js';
import { charAt, noCharacter } from '../game/level.js';
import { isUsable } from './log.js';
import { callsText } from './model.js';
import { actionInfo } from './script.js';

const FORCE_WORDS = ['force', '-f'];
export const SHOT_POWER = 1; // "triggers run" passes this as the shot power some actions read

// "[force] [as <char#>]" anywhere in the arguments. Returns the other words too.
export function takeRunOptions(args, usage) {
  let force = false;
  let activator = game.me();
  const rest = [];
  for (let k = 0; k < args.length; k++) {
    const a = args[k].toLowerCase();
    if (FORCE_WORDS.includes(a)) force = true;
    else if (a === 'as') {
      activator = parseIndex(args[++k]);
      if (activator === null) throw new Error(usage);
      if (!charAt(activator)) throw noCharacter(activator);
    } else rest.push(args[k]);
  }
  return { rest, force, activator };
}

// Why other players would not see this run, or '' when it can be sent.
function localOnly({ usable, activator, refused }) {
  if (!game.isMP()) return '';
  if (!usable) return 'it is disabled or used up for the other players';
  if (refused) return 'forced past the region\'s own condition';
  if (activator !== game.me()) return '"as" another character only works in your game';
  if (game.spectating()) return 'you are spectating';
  return '';
}

// Runs trigger idx (object t). opts: force, activator; region: the region it is run for
// (sent along, as the game does); power: the shot power to pass, or undefined to leave
// it; refused: the run goes past a region's condition, so it stays local; forceHint:
// the command that forces it. Returns { send, putBack }.
export function runTriggerAs(idx, t, { force, activator, region, power, refused = false, forceHint }) {
  const label = `#${idx}${t.uid ? ' ' + t.uid : ''}`;
  const wasEnabled = t[F.T_ENABLED];
  const wasCalls = t[F.T_CALLS];
  const usable = isUsable(t);
  if (!usable && !force) {
    const why = !wasEnabled ? 'is disabled' : `has no calls left (${callsText(t)})`;
    throw new Error(`trigger ${label} ${why}. "${forceHint}" runs it anyway.`);
  }
  if (force) {
    t[F.T_ENABLED] = true;
    if (wasCalls !== -1 && !(wasCalls > 0)) t[F.T_CALLS] = 1;
  }
  const localWhy = localOnly({ usable, activator, refused });
  const send = game.isMP() && !localWhy;
  // A synced run uses up a call on every client, so keep the used call here too.
  const putBack = force && !send;
  const prevActivator = game.triggerActivator();
  const prevPower = game.triggerPower();
  game.setTriggerActivator(activator);
  if (power !== undefined) game.setTriggerPower(power);
  try {
    game.runTrigger(idx);
  } finally {
    game.setTriggerActivator(prevActivator);
    if (power !== undefined) game.setTriggerPower(prevPower);
    if (putBack) { t[F.T_ENABLED] = wasEnabled; t[F.T_CALLS] = wasCalls; }
  }
  if (send) game.sendTriggerRun(idx, region);
  return { label, send, putBack, localWhy };
}

// The line that says what happened, and why it stayed local when it did.
export function reportRun(what, t, activator, { send, putBack, localWhy }) {
  const n = t[F.T_ACTIONS] || 0;
  const by = activator === game.me() ? '' : ` as #${activator}`;
  const where = !game.isMP() ? '' : send ? ', sent to all players' : '';
  print(`Ran ${what}${by} (${plural(n, 'action')})${putBack ? ', forced: enabled state and calls left kept' : `, calls ${callsText(t)}`}${where}`, COLOR.ok);
  if (game.isMP() && !send) print(`Note: ran in your game only, other players do not see it: ${localWhy}.`, COLOR.warn);
}


// ----- Triggers written as text ("triggers exec") -----

// Target kinds that name an object of the map by uid. A "#uid" there that the map does
// not have would reach the action as text, which most actions read as index 0: a
// different object.
const OBJECT_KINDS = new Set(['door', 'region', 'vehicle', 'character', 'gun', 'barrel', 'trigger', 'timer',
  'decor', 'pushf', 'pushf_damage', 'lamp', 'water']);

// The targets as the map loader would store them, or an error naming the first "#uid"
// this map does not have.
export function resolveActions(actions) {
  return actions.map((a) => {
    const info = actionInfo(a.type);
    const out = { ...a, A: game.resolveTarget(a.A), B: game.resolveTarget(a.B) };
    for (const [side, kind] of [['A', info?.a], ['B', info?.b]]) {
      const v = out[side];
      if (typeof v === 'string' && v.startsWith('#') && OBJECT_KINDS.has(kind)) {
        throw new Error(`line ${a.line}: this map has no ${kind} ${v} (${a.name} target ${side})`);
      }
    }
    return out;
  });
}

// Runs a parsed script once as a trigger of its own, through the game's runner like any
// other: it is put in the triggers array just past the map's, run, and removed again, so
// nothing else can start it. Actions that jump to or run other triggers work; nothing
// can refer to this one by uid. activator: who started it (many actions use it).
// Multiplayer: not sent; the other players have no such trigger. What its actions send
// themselves ("vars sync") still goes out.
export function runScript(actions, { activator, uid }) {
  const list = game.triggers();
  const idx = Math.max(list.length, game.triggerCount() || 0);
  const t = {
    uid: uid || undefined,
    [F.T_ENABLED]: true, [F.T_AT_START]: false, [F.T_MAX_CALLS]: 1, [F.T_CALLS]: 1,
    [F.T_ACTIONS]: actions.length,
    [F.T_TYPES]: actions.map((a) => a.type),
    [F.T_A]: actions.map((a) => a.A),
    [F.T_B]: actions.map((a) => a.B),
  };
  const length = list.length;
  const prevActivator = game.triggerActivator();
  const prevPower = game.triggerPower();
  list[idx] = t;
  game.setTriggerActivator(activator);
  game.setTriggerPower(SHOT_POWER);
  try {
    game.runTrigger(idx);
  } finally {
    game.setTriggerActivator(prevActivator);
    game.setTriggerPower(prevPower);
    delete list[idx];
    list.length = length;
  }
  return idx;
}

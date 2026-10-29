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


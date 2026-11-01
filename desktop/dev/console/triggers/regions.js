// Firing a region without being in it: what the game does when a region's condition is
// met (the region check in frame2.js), for any activator.
import { print } from '../ui/log.js';
import { COLOR } from '../../../../src/console/kernel/core/keys.ts';
import { game } from '../../../../src/console/kernel/game/bindings.ts';
import { GAME_FIELDS } from '../../../../src/console/kernel/game/fields.ts';
import { charAt } from '../../../../src/console/kernel/game/level.ts';
import { triggerList, timerList, regionList, REGION_MODE, regionModeName, regionLabel, timerUid } from './model.js';
import { runTriggerAs, reportRun } from './run.js';

const TEAM = Object.freeze({ RED: 12, BLUE: 13 });
const NO_VEHICLE = -1;
const NO_TARGET = -1;

// Why the region's mode would not fire for character i now, setting aside where they
// stand (that is what is being simulated), or '' when it would. Same tests, in the same
// order, as the game's region check.
export function modeRefuses(mode, i) {
  const c = charAt(i);
  const me = i === game.me() && !game.spectating();
  const inVehicle = c[GAME_FIELDS.VEHICLE] !== NO_VEHICLE;
  const alive = c[GAME_FIELDS.HP] > 0;
  const human = !!c[GAME_FIELDS.HUMAN];
  const onTeam = (team) => (c.team === team ? '' : `it is for team ${team}; #${i} is on team ${c.team}`);
  const useKey = () => (!me ? 'only your own use key fires it' : inVehicle ? 'not from a vehicle' : '');
  switch (mode) {
    case REGION_MODE.NEVER: return 'it never fires by itself';
    case REGION_MODE.USE: return useKey();
    case REGION_MODE.ENTER: return inVehicle ? 'not for a character in a vehicle' : '';
    case REGION_MODE.VEHICLE_ENTERS: return inVehicle ? '' : 'only for a character in a vehicle';
    case REGION_MODE.ANYTHING_ENTERS: return '';
    case REGION_MODE.DOOR_ARRIVES: return 'it fires when a door or elevator arrives, not for a character';
    case REGION_MODE.PLAYER_ENTERS:
    case REGION_MODE.TEAM_INSIDE:
      if (!human) return 'only for players, not bots';
      if (!alive) return 'not for the dead';
      return game.isMP() && !me ? 'in multiplayer only for yourself' : '';
    case REGION_MODE.USE_RED: return useKey() || onTeam(TEAM.RED);
    case REGION_MODE.USE_BLUE: return useKey() || onTeam(TEAM.BLUE);
    case REGION_MODE.RED_ENTERS:
    case REGION_MODE.BLUE_ENTERS:
      if (!me) return 'only for yourself';
      if (inVehicle) return 'not from a vehicle';
      if (!alive) return 'not for the dead';
      return onTeam(mode === REGION_MODE.RED_ENTERS ? TEAM.RED : TEAM.BLUE);
    case REGION_MODE.BOT_ENTERS: return human ? 'only for bots' : alive ? '' : 'not for the dead';
    case REGION_MODE.ENEMY_BOT_ENTERS:
      if (human) return 'only for bots';
      if (c.team === game.chars()[game.me()].team) return 'only for bots on another team';
      return alive ? '' : 'not for the dead';
    default: return `unknown mode ${mode}`;
  }
}

// Fires region i as if activator had met its condition. A region with "uses timer"
// enables that timer, as the game does; any other runs its trigger. force: past the
// mode's condition and the trigger's own rules.
export function fireRegion(i, { force, activator }) {
  const r = regionList()[i];
  if (!r) throw new Error(`no region #${i}. This map has ${regionList().length}.`);
  const label = regionLabel(i);
  const target = r[GAME_FIELDS.R_TRIGGER];
  if (typeof target !== 'number' || target === NO_TARGET) throw new Error(`region ${label} runs nothing`);
  const mode = r[GAME_FIELDS.R_USE_ON];
  const refused = modeRefuses(mode, activator);
  if (refused && !force) {
    throw new Error(`region ${label} (${regionModeName(mode)}) would not fire for #${activator}: ${refused}. "regions run ${i} force" fires it anyway.`);
  }
  if (refused) print(`  forced past its condition: ${refused}`, COLOR.hint);
  if (mode === REGION_MODE.TEAM_INSIDE && !refused) print('  (the game also waits for every player of the team to be inside; not checked)', COLOR.hint);

  if (r[GAME_FIELDS.R_USES_TIMER]) {
    const timer = timerList()[target];
    if (!timer) throw new Error(`region ${label} starts timer #${target}, which does not exist`);
    timer[GAME_FIELDS.T_ENABLED] = true;
    print(`Fired region ${label}: started timer #${target}${timerUid(target) ? ' ' + timerUid(target) : ''}`, COLOR.ok);
    if (game.isMP()) print('Note: in your game only. For a timer region the game sends a trigger run with the timer\'s number, which would run the wrong trigger for everyone else, so nothing is sent.', COLOR.warn);
    return;
  }
  const t = triggerList()[target];
  if (!t) throw new Error(`region ${label} runs trigger #${target}, which does not exist`);
  const outcome = runTriggerAs(target, t, { force, activator, region: i, refused: !!refused, forceHint: `regions run ${i} force` });
  reportRun(`region ${label}: trigger ${outcome.label}`, t, activator, outcome);
}

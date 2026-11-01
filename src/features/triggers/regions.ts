import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { game } from '#console/kernel/game/bindings.ts';
import { GAME_FIELDS } from '#console/kernel/game/fields.ts';
import { charAt } from '#console/kernel/game/level.ts';
import { NO_TARGET, NO_VEHICLE, REGION_MODE, TEAM } from './keys.ts';
import { REGION_TEXT as TEXT } from './text.ts';
import { triggerList, timerList, regionList, regionModeName, regionLabel, timerUid } from './model.ts';
import { runTriggerAs, reportRun } from './run.ts';

function teamRefusal(characterTeam: unknown, team: number, index: number): string {
  return characterTeam === team ? '' : TEXT.forTeam(team, index, characterTeam);
}

export function modeRefuses(mode: unknown, index: number): string {
  const character = charAt(index);
  if (!character) return '';
  const isMe = index === game.me() && !game.spectating();
  const inVehicle = character[GAME_FIELDS.VEHICLE] !== NO_VEHICLE;
  const isAlive = character[GAME_FIELDS.HP] > 0;
  const isHuman = !!character[GAME_FIELDS.HUMAN];
  const useKey = (): string => (!isMe ? TEXT.onlyOwnUseKey : inVehicle ? TEXT.notFromVehicle : '');
  switch (mode) {
    case REGION_MODE.NEVER: return TEXT.neverFires;
    case REGION_MODE.USE: return useKey();
    case REGION_MODE.ENTER: return inVehicle ? TEXT.notInVehicle : '';
    case REGION_MODE.VEHICLE_ENTERS: return inVehicle ? '' : TEXT.onlyInVehicle;
    case REGION_MODE.ANYTHING_ENTERS: return '';
    case REGION_MODE.DOOR_ARRIVES: return TEXT.doorArrives;
    case REGION_MODE.PLAYER_ENTERS:
    case REGION_MODE.TEAM_INSIDE:
      if (!isHuman) return TEXT.onlyPlayers;
      if (!isAlive) return TEXT.notDead;
      return game.isMP() && !isMe ? TEXT.onlyYourselfMultiplayer : '';
    case REGION_MODE.USE_RED: return useKey() || teamRefusal(character.team, TEAM.RED, index);
    case REGION_MODE.USE_BLUE: return useKey() || teamRefusal(character.team, TEAM.BLUE, index);
    case REGION_MODE.RED_ENTERS:
    case REGION_MODE.BLUE_ENTERS:
      if (!isMe) return TEXT.onlyYourself;
      if (inVehicle) return TEXT.notFromVehicle;
      if (!isAlive) return TEXT.notDead;
      return teamRefusal(character.team, mode === REGION_MODE.RED_ENTERS ? TEAM.RED : TEAM.BLUE, index);
    case REGION_MODE.BOT_ENTERS:
      if (isHuman) return TEXT.onlyBots;
      return isAlive ? '' : TEXT.notDead;
    case REGION_MODE.ENEMY_BOT_ENTERS:
      if (isHuman) return TEXT.onlyBots;
      if (character.team === game.chars()[game.me()]?.team) return TEXT.onlyEnemyBots;
      return isAlive ? '' : TEXT.notDead;
    default: return TEXT.unknownMode(mode);
  }
}

export function fireRegion(index: number, { force, activator }: { force: boolean; activator: number }): void {
  const region = regionList()[index];
  if (!region) throw new Error(TEXT.noRegion(index, regionList().length));
  const label = regionLabel(index);
  const target = region[GAME_FIELDS.R_TRIGGER];
  if (typeof target !== 'number' || target === NO_TARGET) throw new Error(TEXT.runsNothing(label));
  const mode = region[GAME_FIELDS.R_USE_ON];
  const refused = modeRefuses(mode, activator);
  if (refused && !force) throw new Error(TEXT.wouldNotFire(label, regionModeName(mode), activator, refused, index));
  if (refused) print(TEXT.forcedPast(refused), COLOR.hint);
  if (mode === REGION_MODE.TEAM_INSIDE && !refused) print(TEXT.teamNotChecked, COLOR.hint);

  if (region[GAME_FIELDS.R_USES_TIMER]) {
    const timer = timerList()[target];
    if (!timer) throw new Error(TEXT.noTimer(label, target));
    timer[GAME_FIELDS.T_ENABLED] = true;
    print(TEXT.startedTimer(label, target, timerUid(target)), COLOR.ok);
    if (game.isMP()) print(TEXT.timerLocalOnly, COLOR.warn);
    return;
  }
  const trigger = triggerList()[target];
  if (!trigger) throw new Error(TEXT.noTrigger(label, target));
  const outcome = runTriggerAs(target, trigger, { force, activator, region: index, refused: !!refused, forceHint: TEXT.forceHint(index) });
  reportRun(TEXT.ranVia(label, outcome.label), trigger, activator, outcome);
}

import { print } from '#console/kernel/ui/log.ts';
import { COLOR } from '#console/kernel/core/keys.ts';
import { plural, parseIndex } from '#console/kernel/core/words.ts';
import { game } from '#console/kernel/game/bindings.ts';
import { GAME_FIELDS } from '#console/kernel/game/fields.ts';
import { charAt, noCharacter } from '#console/kernel/game/level.ts';
import { SHOT_POWER } from './constants.ts';
import { AS_WORD, FORCE_WORDS, OBJECT_KINDS, TARGET_SIDES, UID_MARK, UNLIMITED } from './keys.ts';
import { RUN_TEXT as TEXT } from './text.ts';
import { isUsable } from './run-log.ts';
import { callsText, triggerLabel } from './model.ts';
import { actionInfo, type ScriptAction } from './script.ts';
import type { Trigger } from './types.ts';

export { SHOT_POWER };

export type RunOptions = { force: boolean; activator: number; region?: number; power?: number; refused?: boolean; forceHint: string };
export type RunOutcome = { label: string; send: boolean; putBack: boolean; localWhy: string };
export type ResolvedAction = Omit<ScriptAction, 'A' | 'B'> & { A: unknown; B: unknown };

export function takeRunOptions(args: readonly string[], usage: string): { rest: string[]; force: boolean; activator: number } {
  let force = false;
  let activator = game.me();
  const rest: string[] = [];
  for (let index = 0; index < args.length; index++) {
    const word = (args[index] ?? '').toLowerCase();
    if (FORCE_WORDS.includes(word)) {
      force = true;
    } else if (word === AS_WORD) {
      const chosen = parseIndex(args[++index]);
      if (chosen === null) throw new Error(usage);
      if (!charAt(chosen)) throw noCharacter(chosen);
      activator = chosen;
    } else {
      rest.push(args[index] ?? '');
    }
  }
  return { rest, force, activator };
}

function localOnly({ usable, activator, refused }: { usable: boolean; activator: number; refused: boolean }): string {
  if (!game.isMP()) return '';
  if (!usable) return TEXT.disabledOrUsedUp;
  if (refused) return TEXT.forcedPastRegion;
  if (activator !== game.me()) return TEXT.asAnother;
  if (game.spectating()) return TEXT.spectating;
  return '';
}

export function runTriggerAs(index: number, trigger: Trigger, { force, activator, region, power, refused = false, forceHint }: RunOptions): RunOutcome {
  const label = triggerLabel(index, trigger);
  const wasEnabled = trigger[GAME_FIELDS.T_ENABLED];
  const wasCalls = trigger[GAME_FIELDS.T_CALLS];
  const usable = isUsable(trigger);
  if (!usable && !force) {
    const why = !wasEnabled ? TEXT.isDisabled : TEXT.noCallsLeft(callsText(trigger));
    throw new Error(TEXT.notUsable(label, why, forceHint));
  }
  if (force) {
    trigger[GAME_FIELDS.T_ENABLED] = true;
    const hasCalls = wasCalls === UNLIMITED || (typeof wasCalls === 'number' && wasCalls > 0);
    if (!hasCalls) trigger[GAME_FIELDS.T_CALLS] = 1;
  }
  const localWhy = localOnly({ usable, activator, refused });
  const send = !!game.isMP() && !localWhy;
  const putBack = force && !send;
  const previousActivator = game.triggerActivator();
  const previousPower = game.triggerPower();
  game.setTriggerActivator(activator);
  if (power !== undefined) game.setTriggerPower(power);
  try {
    game.runTrigger(index);
  } finally {
    game.setTriggerActivator(previousActivator);
    if (power !== undefined) game.setTriggerPower(previousPower);
    if (putBack) {
      trigger[GAME_FIELDS.T_ENABLED] = wasEnabled;
      trigger[GAME_FIELDS.T_CALLS] = wasCalls;
    }
  }
  if (send) game.sendTriggerRun(index, region);
  return { label, send, putBack, localWhy };
}

export function reportRun(what: string, trigger: Trigger, activator: number, { send, putBack, localWhy }: RunOutcome): void {
  const actions = (trigger[GAME_FIELDS.T_ACTIONS] as number | undefined) || 0;
  const by = activator === game.me() ? '' : TEXT.asCharacter(activator);
  const where = game.isMP() && send ? TEXT.sentToAll : '';
  const state = putBack ? TEXT.forcedKept : TEXT.calls(callsText(trigger));
  print(TEXT.ran(what, by, plural(actions, TEXT.actionNoun), state, where), COLOR.ok);
  if (game.isMP() && !send) print(TEXT.localOnly(localWhy), COLOR.warn);
}

export function resolveActions(actions: readonly ScriptAction[]): ResolvedAction[] {
  return actions.map((action) => {
    const info = actionInfo(action.type);
    const resolved: ResolvedAction = { ...action, A: game.resolveTarget(action.A), B: game.resolveTarget(action.B) };
    for (const side of TARGET_SIDES) {
      const kind = side === TARGET_SIDES[0] ? info?.a : info?.b;
      const value = resolved[side];
      if (typeof value === 'string' && value.startsWith(UID_MARK) && kind && OBJECT_KINDS.has(kind)) throw new Error(TEXT.noSuchObject(action.line, kind, value, action.name, side));
    }
    return resolved;
  });
}

export function runScript(actions: readonly ResolvedAction[], { activator, uid }: { activator: number; uid?: string }): number {
  const list = game.triggers() as unknown[];
  const index = Math.max(list.length, game.triggerCount() || 0);
  const trigger: Trigger = {
    uid: uid || undefined,
    [GAME_FIELDS.T_ENABLED]: true, [GAME_FIELDS.T_AT_START]: false, [GAME_FIELDS.T_MAX_CALLS]: 1, [GAME_FIELDS.T_CALLS]: 1,
    [GAME_FIELDS.T_ACTIONS]: actions.length,
    [GAME_FIELDS.T_TYPES]: actions.map((action) => action.type),
    [GAME_FIELDS.T_A]: actions.map((action) => action.A),
    [GAME_FIELDS.T_B]: actions.map((action) => action.B),
  };
  const length = list.length;
  const previousActivator = game.triggerActivator();
  const previousPower = game.triggerPower();
  list[index] = trigger;
  game.setTriggerActivator(activator);
  game.setTriggerPower(SHOT_POWER);
  try {
    game.runTrigger(index);
  } finally {
    game.setTriggerActivator(previousActivator);
    game.setTriggerPower(previousPower);
    Reflect.deleteProperty(list, index);
    list.length = length;
  }
  return index;
}

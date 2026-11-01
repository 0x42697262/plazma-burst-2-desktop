import { game } from '#console/kernel/game/bindings.ts';
import { GAME_FIELDS } from '#console/kernel/game/fields.ts';
import { ACTION, RUNS_REGION_TRIGGER } from '#console/kernel/game/actions.ts';
import { parseIndex, quote } from '#console/kernel/core/words.ts';
import { MAP_MARKER } from '#shared/contract/keys.ts';
import { stringOf } from '#kernel/text/text-of.ts';
import { TARGET_SHOWN } from './constants.ts';
import { INTEGER_TEXT, REGION_MODE, SOURCE, UID_ATTRIBUTE, UID_ELEMENT, UID_MARK, UID_TAGS, UNLIMITED, type UidTag } from './keys.ts';
import { MODEL_TEXT as TEXT, REGION_MODES } from './text.ts';
import { unwrap } from './run-log.ts';
import type { Action, Trigger, TriggerSource } from './types.ts';

export { REGION_MODE, REGION_MODES, SOURCE };

type Bag = Record<string, unknown>;

export const regionModeName = (mode: unknown): string => REGION_MODES[mode as number] || TEXT.unknownMode(mode);

const upTo = <Item>(list: readonly Item[] | null | undefined, count: unknown): Item[] => (list ?? []).slice(0, typeof count === 'number' ? count : (list ?? []).length);

export const triggerList = (): (Trigger | null | undefined)[] => upTo(game.triggers() as (Trigger | null)[], game.triggerCount()).map(unwrap);
export const regionList = (): (Bag | null | undefined)[] => upTo(game.regions(), game.regionCount());
export const timerList = (): (Bag | null | undefined)[] => upTo(game.timers(), game.timerCount());

export function* actionsOf(trigger: Trigger): Generator<Action> {
  const count = (trigger[GAME_FIELDS.T_ACTIONS] as number | undefined) || 0;
  const types = trigger[GAME_FIELDS.T_TYPES] as number[];
  const targetsA = trigger[GAME_FIELDS.T_A] as unknown[];
  const targetsB = trigger[GAME_FIELDS.T_B] as unknown[];
  for (let action = 0; action < count; action++) yield { n: action + 1, type: types[action] ?? 0, A: targetsA[action], B: targetsB[action] };
}

export const showTarget = (value: unknown): string => (value === undefined || value === null ? TEXT.noTarget : quote(value, TARGET_SHOWN));

export const callsText = (trigger: Trigger): string => (trigger[GAME_FIELDS.T_MAX_CALLS] === UNLIMITED ? TEXT.unlimited : TEXT.callsLeft(trigger[GAME_FIELDS.T_CALLS], trigger[GAME_FIELDS.T_MAX_CALLS]));

export const triggerLabel = (index: number, trigger: Trigger): string => TEXT.label(index, trigger.uid);

export function findTrigger(list: readonly (Trigger | null | undefined)[], query: unknown): number {
  const index = parseIndex(query);
  if (index !== null) return index;
  const lowered = stringOf(query).toLowerCase();
  return list.findIndex((trigger) => trigger && stringOf(trigger.uid).toLowerCase() === lowered);
}

export function triggerIndex(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && INTEGER_TEXT.test(value)) return Number(value);
  if (typeof value === 'string' && value.startsWith(UID_MARK)) return triggerList().findIndex((trigger) => trigger?.uid === value);
  return -1;
}

let uidsFor: unknown = null;
let uidsOf: Record<UidTag, (string | undefined)[]> = { region: [], timer: [], player: [] };

function mapUids(): Record<UidTag, (string | undefined)[]> {
  const text = game.mapText();
  if (text === uidsFor) return uidsOf;
  uidsFor = text;
  uidsOf = { region: [], timer: [], player: [] };
  if (typeof text === 'string' && !text.startsWith(MAP_MARKER.compressedPrefix)) {
    for (const match of text.matchAll(UID_ELEMENT)) {
      const tag = match[1] as UidTag;
      if (!UID_TAGS.includes(tag)) continue;
      uidsOf[tag].push(UID_ATTRIBUTE.exec(match[2] ?? '')?.[1]);
    }
  }
  return uidsOf;
}

export function triggerSources(): Map<number, TriggerSource[]> {
  const sources = new Map<number, TriggerSource[]>();
  const uids = mapUids();
  const add = (target: unknown, kind: string, index: number | undefined, uid: string | undefined, text: string): void => {
    if (typeof target !== 'number' || target < 0) return;
    const list = sources.get(target) ?? [];
    list.push({ kind, index, uid, text });
    sources.set(target, list);
  };
  const regions = regionList();
  regions.forEach((region, index) => {
    if (!region || !region[GAME_FIELDS.R_USE_ON] || region[GAME_FIELDS.R_USES_TIMER]) return;
    const mode = regionModeName(region[GAME_FIELDS.R_USE_ON]);
    const named = TEXT.named(TEXT.region, index, uids.region[index]);
    add(region[GAME_FIELDS.R_TRIGGER], SOURCE.REGION, index, uids.region[index], TEXT.regionAt(named, Math.round(region.x as number), Math.round(region.y as number), mode));
  });
  timerList().forEach((timer, index) => {
    if (timer) add(timer[GAME_FIELDS.TIMER_TARGET], SOURCE.TIMER, index, uids.timer[index], TEXT.named(TEXT.timer, index, uids.timer[index]));
  });
  add(game.sayTrigger(), SOURCE.CHAT, undefined, undefined, TEXT.chatMessage);
  const characters = game.chars() || [];
  for (let index = 0; index < (game.charCount() || 0); index++) {
    const character = characters[index];
    if (character) add(triggerIndex(character[GAME_FIELDS.ON_DEATH]), SOURCE.DEATH, index, uids.player[index], TEXT.deathOf(index, character.nickname));
  }
  triggerList().forEach((trigger, index) => {
    if (!trigger) return;
    const by = TEXT.named(TEXT.trigger, index, trigger.uid);
    for (const { type, A } of actionsOf(trigger)) {
      const target = triggerIndex(A);
      if (type === ACTION.RUN_TRIGGER) add(target, SOURCE.TRIGGER, index, trigger.uid, by);
      else if (type === ACTION.JUMP_TO_TRIGGER) add(target, SOURCE.TRIGGER, index, trigger.uid, TEXT.continuesIn(by));
      else if (RUNS_REGION_TRIGGER.has(type) && regions[target]) add(regions[target][GAME_FIELDS.R_TRIGGER], SOURCE.TRIGGER, index, trigger.uid, TEXT.viaRegion(by, target));
    }
  });
  return sources;
}

export function sourcesOf(sources: ReadonlyMap<number, TriggerSource[]>, index: number, trigger: Trigger): TriggerSource[] {
  const list = sources.get(index) ?? [];
  return trigger[GAME_FIELDS.T_AT_START] ? [{ kind: SOURCE.START, text: TEXT.mapStart }, ...list] : list;
}

export const regionUid = (index: number): string | undefined => mapUids().region[index];
export const timerUid = (index: number): string | undefined => mapUids().timer[index];

export function findRegion(query: unknown): number {
  const index = parseIndex(query);
  if (index !== null) return index;
  const lowered = stringOf(query).toLowerCase();
  return mapUids().region.findIndex((uid) => uid?.toLowerCase() === lowered);
}

export const regionLabel = (index: number): string => TEXT.label(index, regionUid(index));

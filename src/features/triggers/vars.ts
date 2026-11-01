import { game } from '#console/kernel/game/bindings.ts';
import { GAME_FIELDS } from '#console/kernel/game/fields.ts';
import { ACTION, VAR_WRITE_TYPES } from '#console/kernel/game/actions.ts';
import { MAP_MARKER } from '#shared/contract/keys.ts';
import { quote, pluralSuffix } from '#console/kernel/core/words.ts';
import { requireLevel } from '#console/kernel/game/level.ts';
import { stringOf } from '#kernel/text/text-of.ts';
import { DECIMAL_RADIX, QUOTED_MIN_LENGTH, VAR_MAX_LEN } from './constants.ts';
import { FIGHTING_MODES, QUOTE, SYNC_MODE, RECOMMENDED_MODE, SYNC_MODE_KEYS, VAR_SYNC_MARK, VERDICT, type SyncModeKey } from './keys.ts';
import { VARS_TEXT as TEXT } from './text.ts';
import { triggerList, actionsOf } from './model.ts';

export { VAR_MAX_LEN, RECOMMENDED_MODE };

export type SyncMode = { type: number; what: string; how: string };
type Vars = Record<string, unknown>;
export type EditedVar = { name: string; was: unknown; now: unknown };

const SYNC_TYPES: Readonly<Record<SyncModeKey, number>> = Object.freeze({
  r: ACTION.SYNC_REPLACE, d: ACTION.SYNC_DEFAULT, x: ACTION.SYNC_MAX, n: ACTION.SYNC_MIN, l: ACTION.SYNC_LONGEST,
});

export const SYNC_MODES: Readonly<Record<SyncModeKey, SyncMode>> = Object.freeze(Object.fromEntries(
  SYNC_MODE_KEYS.map((mode) => [mode, { type: SYNC_TYPES[mode], ...TEXT.modes[mode] }]),
) as Record<SyncModeKey, SyncMode>);

const modeOfType: Readonly<Record<number, SyncModeKey>> = Object.freeze(Object.fromEntries(SYNC_MODE_KEYS.map((mode) => [SYNC_TYPES[mode], mode])));

export const fights = (mode: string): boolean => FIGHTING_MODES.has(mode);
export const modeName = (mode: SyncModeKey): string => TEXT.modeName(mode, SYNC_MODES[mode].what);

export function mapVars(): Vars {
  const vars = game.mapVars() as Vars | null;
  if (!vars) throw new Error(TEXT.noVariables);
  return vars;
}

const edits = new WeakMap<Vars, Map<string, unknown>>();

export function noteVarEdit(vars: Vars, name: string, before: unknown): void {
  const changes = edits.get(vars) ?? new Map<string, unknown>();
  edits.set(vars, changes);
  if (!changes.has(name)) {
    if (before !== vars[name]) changes.set(name, before);
  } else if (changes.get(name) === vars[name]) {
    changes.delete(name);
  }
}

export function editedVars(): EditedVar[] {
  const vars = game.mapVars() as Vars | null;
  const changes = vars ? edits.get(vars) : undefined;
  if (!vars || !changes) return [];
  return [...changes].map(([name, was]) => ({ name, was, now: vars[name] })).sort((first, second) => first.name.localeCompare(second.name));
}

export function requireVars(): Vars {
  requireLevel();
  return mapVars();
}

export const showVar = (value: unknown): string => (value === undefined ? TEXT.notSet : quote(value));

export function parseVarValue(raw: string): string | number {
  const isQuoted = raw.length >= QUOTED_MIN_LENGTH && raw.startsWith(QUOTE) && raw.endsWith(QUOTE);
  if (isQuoted) return raw.slice(1, -1);
  const number = parseInt(raw, DECIMAL_RADIX);
  return String(number) === raw ? number : raw;
}

export const syncMarkOn = (): boolean => game.varSyncOn();

export function mapHasSyncMark(): boolean | null {
  const text = game.mapText();
  if (typeof text !== 'string' || !text || text.startsWith(MAP_MARKER.compressedPrefix)) return null;
  return text.includes(VAR_SYNC_MARK);
}

export function syncActionsFor(name: string): { idx: number; uid: string | undefined; action: number; mode: SyncModeKey }[] {
  const found: { idx: number; uid: string | undefined; action: number; mode: SyncModeKey }[] = [];
  triggerList().forEach((trigger, index) => {
    if (!trigger) return;
    for (const { n: action, type, A } of actionsOf(trigger)) {
      const mode = modeOfType[type];
      if (mode && stringOf(A) === name) found.push({ idx: index, uid: trigger.uid, action, mode });
    }
  });
  return found;
}

export function seedersFor(name: string): { idx: number; uid: string | undefined; action: number; atStart: boolean; once: boolean }[] {
  const found: { idx: number; uid: string | undefined; action: number; atStart: boolean; once: boolean }[] = [];
  triggerList().forEach((trigger, index) => {
    if (!trigger) return;
    const atStart = !!trigger[GAME_FIELDS.T_AT_START];
    const once = trigger[GAME_FIELDS.T_MAX_CALLS] === 1;
    if (!atStart && !once) return;
    for (const { n: action, type, A } of actionsOf(trigger)) {
      if (VAR_WRITE_TYPES.has(type) && stringOf(A) === name) {
        found.push({ idx: index, uid: trigger.uid, action, atStart, once });
        break;
      }
    }
  });
  return found;
}

export const NO = VERDICT.no;
export const YES = VERDICT.yes;

export function modeVerdict(mode: string, value: unknown): [string, string] {
  const numeric = !isNaN(parseFloat(stringOf(value))) && isFinite(Number(value));
  switch (mode) {
    case SYNC_MODE.replace: return [YES, TEXT.assigns];
    case SYNC_MODE.default: return numeric ? [NO, TEXT.numberKept] : [YES, TEXT.textOverwrites];
    case SYNC_MODE.max: return numeric ? [VERDICT.raiseOnly, TEXT.higherKept] : [NO, TEXT.notANumber];
    case SYNC_MODE.min: return numeric ? [VERDICT.lowerOnly, TEXT.lowerKept] : [NO, TEXT.notANumber];
    case SYNC_MODE.longest: {
      const length = stringOf(value).length;
      return [VERDICT.longerOnly, TEXT.longerOnly(length, pluralSuffix(length), numeric)];
    }
    default: return [NO, TEXT.unknownMode];
  }
}

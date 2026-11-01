import { game } from '#console/kernel/game/bindings.ts';
import { GAME_FIELDS } from '#console/kernel/game/fields.ts';
import { isActive } from '#console/kernel/game/level.ts';
import { KEY } from '#console/kernel/state/schema.ts';
import { settings } from '#console/kernel/state/store.ts';
import { FULL_CHECK_EVERY, REFUSED_MERGE_WINDOW, TRIG_HISTORY_MAX } from './constants.ts';
import { STACK_FRAME_LIMIT, UNLIMITED } from './keys.ts';
import type { Trigger, TriggerRun } from './types.ts';
import { RUN_LOG_TEXT } from './text.ts';

export { TRIG_HISTORY_MAX };

type StackFrame = NodeJS.CallSite;

const runs: TriggerRun[] = [];
const targetOf = new WeakMap<object, Trigger>();
const indexOf = new WeakMap<object, number>();
let hookedArray: unknown[] | null = null;
let hookedCount = -1;
let levelRunning = false;
let frameNumber = 0;

export const triggerRuns = (): TriggerRun[] => runs;
export const clearTriggerRuns = (): void => { runs.length = 0; };
export const unwrap = <Item>(trigger: Item): Item => (trigger && typeof trigger === 'object' ? (targetOf.get(trigger) as Item | undefined) ?? trigger : trigger);

export const isUsable = (trigger: Trigger): boolean => {
  const calls = trigger[GAME_FIELDS.T_CALLS];
  return !!trigger[GAME_FIELDS.T_ENABLED] && (calls === UNLIMITED || (typeof calls === 'number' && calls > 0));
};

function callerName(skip: (...args: never[]) => unknown): string | null {
  const previousLimit = Error.stackTraceLimit;
  // eslint-disable-next-line @typescript-eslint/unbound-method -- saved only to be put back on Error itself
  const previousPrepare = Error.prepareStackTrace;
  try {
    Error.stackTraceLimit = STACK_FRAME_LIMIT;
    Error.prepareStackTrace = (_error, frames) => frames;
    const holder: { stack?: StackFrame[] } = {};
    Error.captureStackTrace(holder, skip);
    return holder.stack?.[0]?.getFunctionName() ?? null;
  } finally {
    Error.stackTraceLimit = previousLimit;
    Error.prepareStackTrace = previousPrepare;
  }
}

function logRun(trigger: Trigger): void {
  const index = indexOf.get(trigger);
  const ok = isUsable(trigger);
  const by = game.triggerActivator();
  const now = performance.now();
  const lookBack = ok ? 1 : REFUSED_MERGE_WINDOW;
  for (let position = runs.length - 1; position >= Math.max(0, runs.length - lookBack); position--) {
    const run = runs[position];
    if (run && run.idx === index && run.by === by && run.ok === ok) {
      run.count++;
      run.last = now;
      if (position !== runs.length - 1) runs.push(...runs.splice(position, 1));
      return;
    }
  }
  const why = ok ? '' : !trigger[GAME_FIELDS.T_ENABLED] ? RUN_LOG_TEXT.disabled : RUN_LOG_TEXT.noCallsLeft;
  runs.push({ idx: index, uid: trigger.uid, by, ok, why, count: 1, first: now, last: now });
  if (runs.length > TRIG_HISTORY_MAX) runs.splice(0, runs.length - TRIG_HISTORY_MAX);
}

function logRunQuietly(trigger: Trigger): void {
  try {
    logRun(trigger);
  } catch {
    return;
  }
}

const proxyHandler: ProxyHandler<Trigger> = {
  get: function trapGet(trigger, property) {
    if (property === GAME_FIELDS.T_ENABLED && callerName(trapGet) === game.runTriggerName()) logRunQuietly(trigger);
    return trigger[property as string];
  },
};

function unhookAll(): void {
  if (!hookedArray) return;
  for (let index = 0; index < hookedArray.length; index++) {
    const wrapped = hookedArray[index];
    const trigger = wrapped && typeof wrapped === 'object' ? targetOf.get(wrapped) : undefined;
    if (trigger) hookedArray[index] = trigger;
  }
  hookedArray = null;
  hookedCount = -1;
}

export function syncTriggerHooks(): void {
  const active = isActive();
  if (active && !levelRunning) clearTriggerRuns();
  levelRunning = active;
  const list = game.triggers() as unknown[];
  const count = game.triggerCount();
  const isRecording = !!settings.effective(KEY.TRIGGER_HISTORY) && active && Array.isArray(list) && typeof count === 'number';
  if (!isRecording) {
    unhookAll();
    return;
  }
  const first = list[0];
  const last = list[count - 1];
  const isHooked = (item: unknown): boolean => !!item && typeof item === 'object' && targetOf.has(item);
  const isSame = list === hookedArray && count === hookedCount && (count === 0 || (isHooked(first) && isHooked(last)));
  if (isSame && ++frameNumber % FULL_CHECK_EVERY) return;
  for (let index = 0; index < count; index++) {
    const trigger = list[index];
    if (!trigger || typeof trigger !== 'object' || targetOf.has(trigger)) continue;
    const proxy = new Proxy(trigger as Trigger, proxyHandler);
    targetOf.set(proxy, trigger as Trigger);
    indexOf.set(trigger, index);
    list[index] = proxy;
  }
  hookedArray = list;
  hookedCount = count;
}

import { GLOBAL, STATUS, TARGET_SYMBOL, GAME_PROPERTY } from '../keys.ts';
import { RUNTIME_ID_START, SEND_DELAY_MS } from './constants.ts';
import { RUNTIME_KEY, getterSource, setterSource } from './keys.ts';
import { RUNTIME_TEXT as TEXT } from './text.ts';
import { textOf } from '#kernel/text/text-of.ts';

type HookConfig = { name: string; status: string; error: string; multiplayer: boolean; description: string; functions: string[]; patches: number };
export type RuntimeConfig = { names?: Record<string, string>; targets?: Record<string, number>; sendUrl: string; hooks: HookConfig[] };
type HookState = HookConfig & { errors: number };
type Callbacks = { onEnter?: (this: CallContext, args: unknown[]) => void; onLeave?: (this: CallContext, retval: ReturnValue) => void };
type Listener = { hook: HookState } & Callbacks;
type Replacement = { hook: HookState; impl: (this: ReplaceContext, ...args: unknown[]) => unknown };
type CallContext = { thisArg: unknown; hook: string };
type ReplaceContext = CallContext & { original: (...args: unknown[]) => unknown };
type AnyFunction = (this: unknown, ...args: unknown[]) => unknown;
type TargetMark = { [TARGET]: true; key: string | null; name: string | null; holder?: Record<PropertyKey, unknown>; prop?: PropertyKey; label?: string };
type Wrap = { holder: Record<PropertyKey, unknown>; prop: PropertyKey; original: AnyFunction; wrapper: AnyFunction; hadOwn: boolean };

const TARGET: unique symbol = Symbol.for(TARGET_SYMBOL) as typeof TARGET;

class ReturnValue {
  value: unknown;

  constructor(value: unknown) {
    this.value = value;
  }

  replace(value: unknown): void {
    this.value = value;
  }

  toString(): string {
    return textOf(this.value);
  }
}

const isTargetMark = (value: unknown): value is TargetMark => typeof value === 'object' && value !== null && TARGET in value;
const messageOf = (error: unknown): string => (error instanceof Error ? error.message : textOf(error));
const stackOf = (error: unknown): string => (error instanceof Error && error.stack ? error.stack : textOf(error));
const indirectEval = (source: string): unknown => (0, eval)(source);

export function startHooksRuntime(config: RuntimeConfig): void {
  const names = config.names ?? {};
  const idOf = config.targets ?? {};
  const listeners: Listener[][] = [];
  const replacements: (Replacement | undefined)[] = [];
  const hooks = new Map(config.hooks.map((hook) => [hook.name, { ...hook, errors: 0 }]));
  let skip = -1;

  const getters = new Map<string, () => unknown>();
  const setters = new Map<string, (value: unknown) => void>();
  function nameOf(key: string): string {
    const name = names[key];
    if (!name) throw new Error(TEXT.noName(key));
    return name;
  }
  function read(key: string): unknown {
    let getter = getters.get(key);
    if (!getter) {
      getter = indirectEval(getterSource(nameOf(key))) as () => unknown;
      getters.set(key, getter);
    }
    return getter();
  }
  function write(key: string, value: unknown): void {
    let setter = setters.get(key);
    if (!setter) {
      setter = indirectEval(setterSource(nameOf(key))) as (value: unknown) => void;
      setters.set(key, setter);
    }
    setter(value);
  }
  function isMP(): boolean {
    try {
      return !!read(RUNTIME_KEY.multiplayer);
    } catch {
      return false;
    }
  }
  const allowed = (hook: HookState): boolean => hook.status === STATUS.loaded && (hook.multiplayer !== false || !isMP());

  function report(hook: HookState, where: string, error: unknown): void {
    hook.errors++;
    console.error(TEXT.reported(hook.name, where, stackOf(error)));
  }

  let queue: { hook: string; msg: unknown }[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  function flush(): void {
    timer = null;
    const batch = queue;
    queue = [];
    fetch(config.sendUrl, { method: RUNTIME_KEY.post, body: JSON.stringify(batch) }).catch(() => undefined);
  }
  function send(hook: HookState, message: unknown): void {
    let sent = message;
    try {
      JSON.stringify(sent);
    } catch {
      sent = textOf(message);
    }
    queue.push({ hook: hook.name, msg: sent });
    timer ??= setTimeout(flush, SEND_DELAY_MS);
  }

  function hasHandlers(id: number): boolean {
    if (skip === id) {
      skip = -1;
      return false;
    }
    return !!(listeners[id]?.length || replacements[id]);
  }

  function call(id: number, self: unknown, argumentList: ArrayLike<unknown>, original: AnyFunction, isDirect = false): unknown {
    const args = Array.prototype.slice.call(argumentList) as unknown[];
    const active = (listeners[id] ?? []).filter((listener) => allowed(listener.hook));
    const replacement = replacements[id];
    const activeReplacement = replacement && allowed(replacement.hook) ? replacement : null;
    const contexts: CallContext[] = active.map((listener) => ({ thisArg: self, hook: listener.hook.name }));
    active.forEach((listener, index) => {
      if (!listener.onEnter) return;
      try {
        listener.onEnter.call(contexts[index] as CallContext, args);
      } catch (error) {
        report(listener.hook, TEXT.onEnter, error);
      }
    });
    const runOriginal = (callArgs: unknown[]): unknown => {
      if (!isDirect) skip = id;
      return original.apply(self, callArgs);
    };
    let result: unknown;
    if (activeReplacement) {
      let failed = false;
      const context: ReplaceContext = { thisArg: self, hook: activeReplacement.hook.name, original: (...callArgs) => runOriginal(callArgs) };
      try {
        result = activeReplacement.impl.apply(context, args);
      } catch (error) {
        report(activeReplacement.hook, TEXT.replacement, error);
        failed = true;
      }
      if (failed) result = runOriginal(args);
    } else {
      result = runOriginal(args);
    }
    if (active.some((listener) => listener.onLeave)) {
      const returned = new ReturnValue(result);
      for (let index = active.length - 1; index >= 0; index--) {
        const listener = active[index];
        if (!listener?.onLeave) continue;
        try {
          listener.onLeave.call(contexts[index] as CallContext, returned);
        } catch (error) {
          report(listener.hook, TEXT.onLeave, error);
        }
      }
      result = returned.value;
    }
    return result;
  }

  let nextRuntimeId = RUNTIME_ID_START;
  const wraps = new Map<number, Wrap>();
  const wrapIds = new WeakMap<object, Map<PropertyKey, number>>();

  function networkOrNull(): unknown {
    try {
      return read(RUNTIME_KEY.network);
    } catch {
      return null;
    }
  }

  function methodTarget(holder: unknown, prop: unknown): TargetMark {
    const isHolder = !!holder && (typeof holder === 'object' || typeof holder === 'function');
    if (!isHolder) throw new Error(TEXT.methodHolder);
    if (typeof prop !== 'string' && typeof prop !== 'symbol') throw new Error(TEXT.methodName);
    const net = networkOrNull();
    const isScanned = holder === globalThis || (!!net && holder === net);
    if (isScanned) throw new Error(TEXT.methodScanned(holder === globalThis));
    return { [TARGET]: true, key: null, name: null, holder: holder as Record<PropertyKey, unknown>, prop, label: TEXT.methodLabel(String(prop)) };
  }

  function wrapMethod(target: TargetMark, api: string): number {
    const holder = target.holder as Record<PropertyKey, unknown>;
    const prop = target.prop as PropertyKey;
    const byProp = wrapIds.get(holder);
    const known = byProp?.get(prop);
    if (known !== undefined && holder[prop] === wraps.get(known)?.wrapper) return known;
    const original = holder[prop];
    if (typeof original !== 'function') throw new Error(TEXT.notAFunction(api, target.label ?? '', original === undefined));
    const id = nextRuntimeId++;
    const hadOwn = Object.prototype.hasOwnProperty.call(holder, prop);
    const wrapper: AnyFunction = function (this: unknown, ...args: unknown[]) {
      return call(id, this, args, original as AnyFunction, true);
    };
    holder[prop] = wrapper;
    if (holder[prop] !== wrapper) throw new Error(TEXT.readOnly(api, target.label ?? ''));
    wraps.set(id, { holder, prop, original: original as AnyFunction, wrapper, hadOwn });
    (byProp ?? wrapIds.set(holder, new Map()).get(holder))?.set(prop, id);
    return id;
  }

  function unwrapIfUnused(id: number): void {
    const wrap = wraps.get(id);
    if (!wrap || listeners[id]?.length || replacements[id]) return;
    if (wrap.holder[wrap.prop] === wrap.wrapper) {
      if (wrap.hadOwn) wrap.holder[wrap.prop] = wrap.original;
      else delete wrap.holder[wrap.prop];
    }
    wraps.delete(id);
    const byProp = wrapIds.get(wrap.holder);
    if (byProp?.get(wrap.prop) === id) byProp.delete(wrap.prop);
  }

  const targetLabel = (target: TargetMark): string => target.key ?? target.name ?? target.label ?? '';

  function resolve(target: unknown, api: string): number {
    if (!isTargetMark(target)) throw new Error(TEXT.badTarget(api));
    if (target.holder) return wrapMethod(target, api);
    const id = target.name === null ? undefined : idOf[target.name];
    if (id === undefined) throw new Error(TEXT.notInstrumented(api, targetLabel(target)));
    return id;
  }

  function removeListener(id: number, listener: Listener): void {
    const list = listeners[id] ?? [];
    const at = list.indexOf(listener);
    if (at >= 0) list.splice(at, 1);
    unwrapIfUnused(id);
  }

  function apiFor(hook: HookState) {
    const mine: [number, Listener][] = [];
    const interceptor = {
      attach(target: unknown, callbacks: Callbacks = {}) {
        const id = resolve(target, TEXT.attachApi);
        const listener: Listener = { hook, onEnter: callbacks.onEnter, onLeave: callbacks.onLeave };
        (listeners[id] ??= []).push(listener);
        mine.push([id, listener]);
        return { detach: () => removeListener(id, listener) };
      },
      replace(target: unknown, impl: unknown) {
        if (typeof impl !== 'function') throw new Error(TEXT.replacementFunction);
        const id = resolve(target, TEXT.replaceApi);
        const previous = replacements[id];
        if (previous && previous.hook !== hook) console.warn(TEXT.replacesOther(hook.name, isTargetMark(target) ? targetLabel(target) : '', previous.hook.name));
        replacements[id] = { hook, impl: impl as Replacement['impl'] };
      },
      revert(target: unknown) {
        const id = resolve(target, TEXT.revertApi);
        if (replacements[id]?.hook === hook) replacements[id] = undefined;
        unwrapIfUnused(id);
      },
      detachAll() {
        for (const [id, listener] of mine) removeListener(id, listener);
        mine.length = 0;
      },
    };
    const script = { patch: () => undefined };
    const game = new Proxy({}, {
      get(_object, key) {
        if (typeof key !== 'string') return undefined;
        if (key === GAME_PROPERTY.read) return read;
        if (key === GAME_PROPERTY.write) return write;
        if (key === GAME_PROPERTY.isMP) return isMP;
        if (key === GAME_PROPERTY.names) return { ...names };
        if (key === GAME_PROPERTY.fn) return (name: unknown) => ({ [TARGET]: true, key: null, name: textOf(name) });
        if (key === GAME_PROPERTY.method) return methodTarget;
        return { [TARGET]: true, key, name: nameOf(key) };
      },
    });
    return { interceptor, script, game, send: (message: unknown) => send(hook, message) };
  }

  type HookBody = (this: undefined, interceptor: unknown, script: unknown, game: unknown, send: (message: unknown) => void, module: { exports: object }, exports: object) => void;

  function define(name: string, body: HookBody): void {
    const hook = hooks.get(name);
    if (!hook) return;
    const api = apiFor(hook);
    const module = { exports: {} };
    try {
      body.call(undefined, api.interceptor, api.script, api.game, api.send, module, module.exports);
    } catch (error) {
      api.interceptor.detachAll();
      hook.status = STATUS.error;
      hook.error = TEXT.inTheGame(messageOf(error));
      report(hook, TEXT.topLevel, error);
    }
  }

  const status = () => [...hooks.values()].map((hook) => ({
    name: hook.name,
    status: hook.status,
    error: hook.error,
    multiplayer: hook.multiplayer,
    description: hook.description,
    functions: hook.functions.slice(),
    patches: hook.patches,
    errors: hook.errors,
    activeNow: allowed(hook),
  }));

  Object.defineProperty(globalThis, GLOBAL, {
    value: Object.freeze({ t: hasHandlers, c: call, define, active: (name: string) => { const hook = hooks.get(name); return !!hook && allowed(hook); }, status }),
    enumerable: false,
    writable: false,
    configurable: false,
  });
}

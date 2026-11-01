import { TAP_SYMBOL_NAME } from './keys.ts';

type Listener = (...args: unknown[]) => void;
export type Rewriter = (args: unknown[]) => unknown[];
type Method = ((...args: unknown[]) => unknown) & { [TAP]?: TapRecord };
type TapRecord = { own: Method | null; listeners: Map<string, Listener>; rewriters: Map<string, Rewriter> };
type Tappable = Record<string, unknown>;

const TAP: unique symbol = Symbol(TAP_SYMBOL_NAME);

function rewritten(rewriters: Map<string, Rewriter>, args: unknown[]): unknown[] {
  let current = args;
  for (const rewrite of rewriters.values()) {
    try {
      current = rewrite(current);
    } catch {
      continue;
    }
  }
  return current;
}

function tapRecordOf(target: object | null | undefined, key: string): TapRecord | null {
  if (!target) return null;
  const object = target as Tappable;
  const current = object[key] as Method | undefined;
  if (typeof current !== 'function') return null;
  const existing = current[TAP];
  if (existing) return existing;
  const original = current;
  const record: TapRecord = { own: Object.hasOwn(object, key) ? original : null, listeners: new Map(), rewriters: new Map() };
  const tapped: Method = function (this: unknown, ...args: unknown[]) {
    for (const each of record.listeners.values()) {
      try {
        each.apply(this, args);
      } catch {
        continue;
      }
    }
    return original.apply(this, rewritten(record.rewriters, args));
  };
  tapped[TAP] = record;
  object[key] = tapped;
  return record;
}

export function tap(target: object | null | undefined, key: string, owner: string, listener: Listener): void {
  tapRecordOf(target, key)?.listeners.set(owner, listener);
}

export function rewriteArguments(target: object | null | undefined, key: string, owner: string, rewriter: Rewriter): void {
  tapRecordOf(target, key)?.rewriters.set(owner, rewriter);
}

export function untap(target: object | null | undefined, key: string, owner: string): void {
  if (!target || !Object.hasOwn(target, key)) return;
  const object = target as Tappable;
  const current = object[key] as Method | undefined;
  const record = current?.[TAP];
  if (!record) return;
  record.listeners.delete(owner);
  record.rewriters.delete(owner);
  if (record.listeners.size || record.rewriters.size) return;
  if (record.own) object[key] = record.own;
  else delete object[key];
}

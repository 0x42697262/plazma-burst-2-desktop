import { TAP_SYMBOL_NAME } from './keys.ts';

type Listener = (...args: unknown[]) => void;
type Method = ((...args: unknown[]) => unknown) & { [TAP]?: TapRecord };
type TapRecord = { own: Method | null; listeners: Map<string, Listener> };
type Tappable = Record<string, unknown>;

const TAP: unique symbol = Symbol(TAP_SYMBOL_NAME);

export function tap(target: object | null | undefined, key: string, owner: string, listener: Listener): void {
  if (!target) return;
  const object = target as Tappable;
  let current = object[key] as Method | undefined;
  if (typeof current !== 'function') return;
  if (!current[TAP]) {
    const original = current;
    const listeners = new Map<string, Listener>();
    const tapped: Method = function (this: unknown, ...args: unknown[]) {
      for (const each of listeners.values()) {
        try {
          each.apply(this, args);
        } catch {
          continue;
        }
      }
      return original.apply(this, args);
    };
    tapped[TAP] = { own: Object.hasOwn(object, key) ? original : null, listeners };
    object[key] = tapped;
    current = tapped;
  }
  current[TAP]?.listeners.set(owner, listener);
}

export function untap(target: object | null | undefined, key: string, owner: string): void {
  if (!target || !Object.hasOwn(target, key)) return;
  const object = target as Tappable;
  const current = object[key] as Method | undefined;
  const record = current?.[TAP];
  if (!record) return;
  record.listeners.delete(owner);
  if (record.listeners.size) return;
  if (record.own) object[key] = record.own;
  else delete object[key];
}

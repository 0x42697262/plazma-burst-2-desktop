import { WRAP_SYMBOL_NAME } from '../keys.ts';

type Method = ((...args: unknown[]) => unknown) & { [WRAP]?: { own: Method | null } };
type Wrappable = Record<string, unknown>;
export type BeforeCall = (target: unknown, args: readonly unknown[]) => void;

export type MethodWrapper = {
  wrap(target: object | null | undefined, key: string, before: BeforeCall): void;
  unwrap(target: object | null | undefined, key: string): void;
};

const WRAP: unique symbol = Symbol(WRAP_SYMBOL_NAME);

export const methodWrapper: MethodWrapper = {
  wrap(target, key, before) {
    if (!target) return;
    const object = target as Wrappable;
    const current = object[key] as Method | undefined;
    if (typeof current !== 'function' || current[WRAP]) return;
    const wrapped: Method = function (this: unknown, ...args: unknown[]) {
      before(this, args);
      return current.apply(this, args);
    };
    wrapped[WRAP] = { own: Object.hasOwn(object, key) ? current : null };
    object[key] = wrapped;
  },
  unwrap(target, key) {
    if (!target || !Object.hasOwn(target, key)) return;
    const object = target as Wrappable;
    const current = object[key] as Method | undefined;
    const record = current?.[WRAP];
    if (!record) return;
    if (record.own) object[key] = record.own;
    else delete object[key];
  },
};

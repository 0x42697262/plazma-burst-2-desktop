import fs from 'node:fs';
import vm from 'node:vm';
import { COUNT_ALL, GAME_PROPERTY, NAMES_GLOBAL, PAGE_ONLY_PROPERTIES, TARGET_SYMBOL, TEXT_ENCODING, sandboxWrapper } from '../keys.ts';
import { TEXT } from '../text.ts';
import { textOf } from '#kernel/text/text-of.ts';
import { isRegExp, type Names, type Patch, type Replace, type Target } from '../domain/patching.ts';

export type HookOptions = { enabled: boolean; multiplayer: boolean; description: string };
export type DryRun = { options: HookOptions; targets: Target[]; patches: Patch[] };
type TargetMark = { [TARGET]: true; key: string | null; name: string };
type HookModule = { exports: Record<string, unknown> };
type HookBody = (interceptor: unknown, script: unknown, game: unknown, send: () => void, module: HookModule, exports: Record<string, unknown>) => void;

const TARGET: unique symbol = Symbol.for(TARGET_SYMBOL) as typeof TARGET;
const LINE_OFFSET = -1;

export function loadNames(file: string): Names {
  try {
    const context: Record<string, unknown> = {};
    context.globalThis = context;
    vm.createContext(context);
    vm.runInContext(fs.readFileSync(file, TEXT_ENCODING), context, { filename: file });
    const names = context[NAMES_GLOBAL];
    return names && typeof names === 'object' ? { ...(names as Names) } : {};
  } catch {
    return {};
  }
}

const markTarget = (key: string | null, name: string): TargetMark => ({ [TARGET]: true, key, name });
const isTargetMark = (value: unknown): value is TargetMark => typeof value === 'object' && value !== null && TARGET in value;
const isValidCount = (count: unknown): count is number | typeof COUNT_ALL => count === COUNT_ALL || (Number.isInteger(count) && (count as number) > 0);

export function dryRun(file: string, code: string, names: Names): DryRun {
  const targets: Target[] = [];
  const patches: Patch[] = [];
  const pageOnly = (what: string) => () => { throw new Error(TEXT.pageOnly(what)); };
  const addTarget = (target: unknown, api: string) => {
    if (!isTargetMark(target)) throw new Error(TEXT.badTarget(api));
    targets.push({ key: target.key, name: target.name });
    return { detach: () => undefined };
  };
  const game = new Proxy({}, {
    get(_object, key) {
      if (typeof key !== 'string') return undefined;
      if (key === GAME_PROPERTY.fn) return (name: unknown) => markTarget(null, textOf(name));
      if (key === GAME_PROPERTY.names) return { ...names };
      if (PAGE_ONLY_PROPERTIES.includes(key)) return pageOnly(TEXT.pageOnlyName(key));
      const name = names[key];
      if (!name) throw new Error(TEXT.unknownGameName(key));
      return markTarget(key, name);
    },
  });
  const interceptor = {
    attach: (target: unknown) => addTarget(target, TEXT.attachApi),
    replace: (target: unknown) => { addTarget(target, TEXT.replaceApi); },
    revert: () => undefined,
    detachAll: () => undefined,
  };
  const script = {
    patch(scriptFile: unknown, find: unknown, replace: unknown, options: { count?: unknown } = {}) {
      if (typeof scriptFile !== 'string') throw new Error(TEXT.patchFirstArgument);
      if (typeof find !== 'string' && !isRegExp(find)) throw new Error(TEXT.patchFind);
      if (typeof replace !== 'string' && typeof replace !== 'function') throw new Error(TEXT.patchReplace);
      const count = options.count === undefined ? 1 : options.count;
      if (!isValidCount(count)) throw new Error(TEXT.patchCount);
      patches.push({ file: scriptFile, find, replace: replace as Replace, count });
    },
  };
  const module: HookModule = { exports: {} };
  const context = vm.createContext({ console });
  const body = new vm.Script(sandboxWrapper(code), { filename: file, lineOffset: LINE_OFFSET }).runInContext(context) as HookBody;
  body(interceptor, script, game, () => undefined, module, module.exports);
  const exported = module.exports;
  return {
    options: {
      enabled: exported.enabled !== false,
      multiplayer: exported.multiplayer !== false,
      description: typeof exported.description === 'string' ? exported.description : '',
    },
    targets,
    patches,
  };
}

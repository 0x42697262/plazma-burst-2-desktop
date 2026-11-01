import fs from 'node:fs';
import path from 'node:path';
import { EXAMPLE_SUFFIX, HOOK_EXTENSION, INDEX_HTML, LOG_LEVEL_OF_STATUS, SKIPPED_PREFIX, STATUS, TEXT_ENCODING, type HookStatus } from '../keys.ts';
import { TEXT } from '../text.ts';
import { HookClash, apply, listScripts, validate, type Names, type Patch, type Target } from '../domain/patching.ts';
import { dryRun, type HookOptions } from '../adapters/sandbox.ts';

export type Hook = { name: string; file: string; status: HookStatus; error: string; options: HookOptions; targets: Target[]; patches: Patch[]; code: string };
export type Plan = { hooks: Hook[]; files: Map<string, string>; targets: Record<string, number>; loaded: Hook[]; names: Names };

export const isHookFile = (file: string): boolean => file.endsWith(HOOK_EXTENSION) && !file.endsWith(EXAMPLE_SUFFIX) && !SKIPPED_PREFIX.test(file);
const hookNameOf = (file: string): string => file.slice(0, -HOOK_EXTENSION.length);

function readHook(hooksDir: string, entry: string, names: Names, originals: ReadonlyMap<string, string>): Hook {
  const file = path.join(hooksDir, entry);
  const hook: Hook = { name: hookNameOf(entry), file, status: STATUS.loaded, error: '', options: { enabled: true, multiplayer: true, description: '' }, targets: [], patches: [], code: '' };
  try {
    hook.code = fs.readFileSync(file, TEXT_ENCODING);
    Object.assign(hook, dryRun(file, hook.code, names));
    if (!hook.options.enabled) {
      hook.status = STATUS.disabled;
      return hook;
    }
    validate(hook, originals, names);
  } catch (error) {
    hook.status = STATUS.error;
    hook.error = (error as Error | null)?.message ?? String(error);
  }
  return hook;
}

export function buildPlan({ gameDir, hooksDir, names = {} }: { gameDir: string; hooksDir: string; names?: Names }): Plan {
  const plan: Plan = { hooks: [], files: new Map(), targets: {}, loaded: [], names };
  let entries: string[];
  try {
    entries = fs.readdirSync(hooksDir).filter(isHookFile).sort();
  } catch {
    return plan;
  }
  if (!entries.length) return plan;
  const html = fs.readFileSync(path.join(gameDir, INDEX_HTML), TEXT_ENCODING);
  const originals = new Map<string, string>();
  for (const relative of listScripts(html)) {
    if (!relative.endsWith(HOOK_EXTENSION)) continue;
    try {
      originals.set(relative, fs.readFileSync(path.join(gameDir, relative), TEXT_ENCODING));
    } catch {
      continue;
    }
  }
  plan.hooks = entries.map((entry) => readHook(hooksDir, entry, names, originals));
  for (;;) {
    const ready = plan.hooks.filter((hook) => hook.status === STATUS.loaded);
    try {
      Object.assign(plan, apply(ready, originals, names));
      plan.loaded = ready;
      return plan;
    } catch (clash) {
      if (!(clash instanceof HookClash)) throw clash;
      const hook = clash.hook as Hook;
      hook.status = STATUS.error;
      hook.error = clash.message;
    }
  }
}

export function describePlan(plan: Plan): [typeof LOG_LEVEL_OF_STATUS[keyof typeof LOG_LEVEL_OF_STATUS], string][] {
  return plan.hooks.map((hook) => {
    if (hook.status === STATUS.error) return [LOG_LEVEL_OF_STATUS.error, TEXT.notLoaded(hook.name, hook.error)];
    if (hook.status === STATUS.disabled) return [LOG_LEVEL_OF_STATUS.info, TEXT.disabled(hook.name)];
    const parts: string[] = [];
    if (hook.targets.length) parts.push(TEXT.plural(hook.targets.length, TEXT.functionWord));
    if (hook.patches.length) parts.push(TEXT.plural(hook.patches.length, TEXT.patchWord, TEXT.patchSuffix));
    if (!hook.options.multiplayer) parts.push(TEXT.offInMultiplayer);
    return [LOG_LEVEL_OF_STATUS.info, TEXT.loaded(hook.name, parts)];
  });
}

import { ROUTE_DIR, ROUTES, SCRIPT_TAG_START, hookServed, hookTag, runtimeServed, runtimeTag } from '../keys.ts';
import type { Plan } from '../services/plan.ts';

export function injectTags(html: string, plan: Plan): string {
  if (!plan.hooks.length) return html;
  const tags = runtimeTag() + plan.loaded.map((hook) => hookTag(hook.name)).join('');
  const at = html.search(SCRIPT_TAG_START);
  return at < 0 ? html : html.slice(0, at) + tags + html.slice(at);
}

export function runtimeScript(plan: Plan, runtimeBundle: string): string {
  const config = {
    names: plan.names,
    targets: plan.targets,
    sendUrl: ROUTE_DIR + ROUTES.send,
    hooks: plan.hooks.map((hook) => ({
      name: hook.name,
      status: hook.status,
      error: hook.error,
      multiplayer: hook.options.multiplayer,
      description: hook.options.description,
      functions: hook.targets.map((target) => target.key ?? target.name),
      patches: hook.patches.length,
    })),
  };
  return runtimeServed(runtimeBundle, JSON.stringify(config));
}

export function hookScript(plan: Plan, name: string): string | null {
  const hook = plan.loaded.find((candidate) => candidate.name === name);
  return hook ? hookServed(name, hook.code) : null;
}

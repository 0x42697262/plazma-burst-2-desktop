import fs from 'node:fs';
import { FEATURE } from '#shared/features/keys.ts';
import { HTTP_METHOD } from '#shared/contract/keys.ts';
import type { Interceptor, WrapperDeps, WrapperFeature } from '#wrapper/feature-types.ts';
import { errorResponse, notFound } from '#wrapper/http/responses.ts';
import { HEADER, NO_STORE, STATUS as HTTP_STATUS } from '#wrapper/http/keys.ts';
import { textOf } from '#kernel/text/text-of.ts';
import { HOOK_EXTENSION, JAVASCRIPT_TYPE, ROUTE_DIR, ROUTES, SEND_OK, TEXT_ENCODING } from './keys.ts';
import { TEXT } from './text.ts';
import { HOOKS_DIR, RUNTIME_BUNDLE } from './paths.ts';
import { loadNames } from './adapters/sandbox.ts';
import { buildPlan, describePlan, type Plan } from './services/plan.ts';
import { hookScript, injectTags, runtimeScript } from './entry/page.ts';

const scriptResponse = (text: string): Response => new Response(text, { headers: { [HEADER.contentType]: JAVASCRIPT_TYPE, [HEADER.cacheControl]: NO_STORE } });

type SentMessage = { hook?: unknown; msg?: unknown };

function parseBatch(body: string): SentMessage[] {
  try {
    const parsed: unknown = JSON.parse(body);
    return Array.isArray(parsed) ? parsed as SentMessage[] : [];
  } catch {
    return [];
  }
}

export type HooksPorts = { namesFile: string; gamePrefix: string; hooksDir?: string };

export function createHooksWrapper(deps: WrapperDeps, ports: HooksPorts) {
  let plan: Plan | null = null;
  const prefix = ports.gamePrefix + ROUTE_DIR;

  function rebuild(): void {
    const names = loadNames(ports.namesFile);
    try {
      plan = buildPlan({ gameDir: deps.gameDir, hooksDir: ports.hooksDir ?? HOOKS_DIR, names });
    } catch (error) {
      deps.log.error(TEXT.planFailed((error as Error).message));
      plan = null;
      return;
    }
    for (const [level, text] of describePlan(plan)) deps.log[level](text);
  }

  function injectIndex(html: string): string {
    rebuild();
    if (!plan) return html;
    const changed = injectTags(html, plan);
    if (plan.hooks.length && changed === html) {
      deps.log.error(TEXT.noScriptTag);
      plan = null;
    }
    return changed;
  }

  const changedScript = (relative: string): string | null => plan?.files.get(relative) ?? null;

  const serve: Interceptor = async (request, url) => {
    if (!url.pathname.startsWith(prefix)) return null;
    const name = decodeURIComponent(url.pathname.slice(prefix.length));
    if (!plan) return errorResponse(TEXT.noHooksLoaded, HTTP_STATUS.notFound);
    if (name === ROUTES.runtime) return scriptResponse(runtimeScript(plan, fs.readFileSync(RUNTIME_BUNDLE, TEXT_ENCODING)));
    if (name.startsWith(ROUTES.hook) && name.endsWith(HOOK_EXTENSION)) {
      const text = hookScript(plan, name.slice(ROUTES.hook.length, -HOOK_EXTENSION.length));
      return text ? scriptResponse(text) : notFound();
    }
    if (name === ROUTES.send && request.method === HTTP_METHOD.post) {
      for (const entry of parseBatch(await request.text())) deps.log.info(TEXT.sent(textOf(entry.hook), textOf(entry.msg)));
      return new Response(SEND_OK);
    }
    return notFound();
  };

  const feature: WrapperFeature = Object.freeze({ id: FEATURE.hooks, interceptors: [serve] });
  return { feature, injectIndex, changedScript, plan: () => plan };
}

export type HooksWrapper = ReturnType<typeof createHooksWrapper>;

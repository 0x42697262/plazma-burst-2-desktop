import { ROUTE_NAME } from '#shared/contract/keys.ts';
import { HTTP_METHOD, STATUS } from '#wrapper/http/keys.ts';
import { errorResponse, jsonResponse, notFound } from '#wrapper/http/responses.ts';
import type { DevRoute, RequestContext } from '#wrapper/feature-types.ts';
import { REMOTE_SHOT_INTERVAL_MS } from '../constants.ts';
import { TEXT } from '../text.ts';
import type { CapturableWindow } from '../adapters/window-capture.ts';

export type ScreenshotRouteDeps = { save: (window: CapturableWindow | null | undefined) => Promise<string>; now: () => number };

export function screenshotRoute({ save, now }: ScreenshotRouteDeps): DevRoute {
  const lastShotOf = new WeakMap<RequestContext, number>();
  async function handle(request: Request, _url: URL, context: RequestContext): Promise<Response> {
    if (request.method !== HTTP_METHOD.post) return notFound();
    if (context.remote) {
      const time = now();
      if (time - (lastShotOf.get(context) ?? 0) < REMOTE_SHOT_INTERVAL_MS) return errorResponse(TEXT.tooOften, STATUS.tooMany);
      lastShotOf.set(context, time);
    }
    try {
      return jsonResponse({ file: await save(context.window as CapturableWindow | undefined) });
    } catch (error) {
      return errorResponse((error as Error).message, STATUS.serverError);
    }
  }
  return { name: ROUTE_NAME.screenshot, handle };
}

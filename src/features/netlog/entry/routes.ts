import path from 'node:path';
import { ROUTE_NAME } from '#shared/contract/keys.ts';
import { HTTP_METHOD, STATUS } from '#wrapper/http/keys.ts';
import { errorResponse, jsonResponse, notFound, textResponse } from '#wrapper/http/responses.ts';
import type { DevRoute, RequestContext } from '#wrapper/feature-types.ts';
import type { Logger } from '#kernel/log/logger.ts';
import { LOG_LEVEL } from '#kernel/log/constants.ts';
import { NETLOG_EVENT } from '../events.ts';
import { LINE_BREAK, LOG_FILE_EXTENSION, RUN_QUERY } from '../keys.ts';
import { ROUTE_TEXT } from '../text.ts';
import { instanceFor, type InstanceContext } from '../domain/log-file.ts';
import { StatusError, type NetLogFiles } from '../adapters/log-files.ts';

export type NetlogRouteDeps = { files: NetLogFiles; repoRoot: string; isSadburst: boolean; log: Logger };

const instanceContextOf = (context: RequestContext): InstanceContext => ({
  remote: context.remote === true,
  server: context.server === true,
  name: typeof context.name === 'string' ? context.name : '',
});

export function netlogRoutes({ files, repoRoot, isSadburst, log }: NetlogRouteDeps): DevRoute[] {
  const instanceOf = (context: RequestContext): string => instanceFor(instanceContextOf(context), isSadburst);
  const fileOf = (run: string): string => path.relative(repoRoot, path.join(files.dir, run + LOG_FILE_EXTENSION));

  async function append(request: Request, _url: URL, context: RequestContext): Promise<Response> {
    if (request.method !== HTTP_METHOD.post) return notFound();
    let lines: unknown;
    try {
      lines = JSON.parse(await request.text());
    } catch (error) {
      return errorResponse((error as Error).message, STATUS.badRequest);
    }
    try {
      const run = await files.append(instanceOf(context), lines);
      return jsonResponse({ run, file: fileOf(run) });
    } catch (error) {
      const message = (error as Error).message;
      log.event(LOG_LEVEL.warn, NETLOG_EVENT.writeFailed, { message: ROUTE_TEXT.writeFailed(message) });
      return errorResponse(message, STATUS.serverError);
    }
  }

  async function runs(_request: Request, _url: URL, context: RequestContext): Promise<Response> {
    const own = files.runName(instanceOf(context));
    const all = await files.list();
    const visible = context.remote ? all.filter((run) => run.mine && run.name === own) : all;
    return jsonResponse(visible.map((run) => ({ ...run, current: run.name === own })));
  }

  async function read(_request: Request, url: URL, context: RequestContext): Promise<Response> {
    const own = files.runName(instanceOf(context));
    const run = url.searchParams.get(RUN_QUERY.run) || own;
    if (!run) return errorResponse(ROUTE_TEXT.nothingYet, STATUS.notFound);
    if (context.remote && run !== own) return errorResponse(ROUTE_TEXT.notAvailable, STATUS.forbidden);
    try {
      const lines = await files.read(run, Number(url.searchParams.get(RUN_QUERY.lines)) || undefined);
      return textResponse(lines.join(LINE_BREAK));
    } catch (error) {
      return errorResponse((error as Error).message, error instanceof StatusError ? error.status : STATUS.serverError);
    }
  }

  return [
    { name: ROUTE_NAME.netLog, handle: append },
    { name: ROUTE_NAME.netRuns, handle: runs },
    { name: ROUTE_NAME.netRead, handle: read },
  ];
}

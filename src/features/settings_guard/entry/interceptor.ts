import type { Interceptor, RequestContext } from '#wrapper/feature-types.ts';
import { REFUSED_STATUS } from '../constants.ts';
import { CONTENT_TYPE_HEADER, PUT_METHOD, TEXT_TYPE } from '../keys.ts';
import { TEXT } from '../text.ts';
import { newRiskyCommands, type RiskyCommand } from '../domain/risky.ts';

export type SettingsRoute = Readonly<{ host: string; path: string }>;

export type SettingsGuardDeps = Readonly<{
  route: SettingsRoute;
  confirm(commands: readonly RiskyCommand[], context: RequestContext): Promise<boolean>;
  log?: (message: string) => void;
}>;

type PeekableFile = { peek(): Promise<string> };

const parsed = (text: string): unknown => {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
};

const refused = (): Response => new Response(TEXT.refused, { status: REFUSED_STATUS, headers: { [CONTENT_TYPE_HEADER]: TEXT_TYPE } });

const decodedPath = (pathname: string): string => {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return pathname;
  }
};

export function settingsGuardInterceptor({ route, confirm, log = () => undefined }: SettingsGuardDeps): Interceptor {
  let asking: Promise<unknown> = Promise.resolve();
  const oneAtATime = <Answer>(ask: () => Promise<Answer>): Promise<Answer> => {
    const answer = asking.then(ask, ask);
    asking = answer.catch(() => undefined);
    return answer;
  };
  return async (request, url, context) => {
    const isSettingsSave = request.method === PUT_METHOD && url.hostname === route.host && decodedPath(url.pathname) === route.path;
    if (!isSettingsSave) return null;
    const file = context.kvFile as PeekableFile | null | undefined;
    const previous = file ? parsed(await file.peek()) : null;
    const risky = newRiskyCommands(previous, parsed(await request.clone().text()));
    if (!risky.length) return null;
    const isKept = !context.remote && await oneAtATime(() => confirm(risky, context));
    log(isKept ? TEXT.keptLog(risky.length) : TEXT.refusedLog(risky.length));
    return isKept ? null : refused();
  };
}

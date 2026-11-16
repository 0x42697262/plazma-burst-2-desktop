import type { Interceptor, RequestContext } from '#wrapper/feature-types.ts';
import { REFUSED_STATUS } from '../constants.ts';
import { CONTENT_TYPE_HEADER, PUT_METHOD, SETTINGS_ROUTE_END, TEXT_TYPE } from '../keys.ts';
import { TEXT } from '../text.ts';
import { newRiskyCommands, type RiskyCommand } from '../domain/risky.ts';

export type SettingsGuardDeps = Readonly<{
  confirm(commands: readonly RiskyCommand[], context: RequestContext): Promise<boolean>;
  log?: (message: string) => void;
}>;

type ReadableFile = { read(): Promise<string> };

const parsed = (text: string): unknown => {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
};

const refused = (): Response => new Response(TEXT.refused, { status: REFUSED_STATUS, headers: { [CONTENT_TYPE_HEADER]: TEXT_TYPE } });

export function settingsGuardInterceptor({ confirm, log = () => undefined }: SettingsGuardDeps): Interceptor {
  return async (request, url, context) => {
    const isSettingsSave = request.method === PUT_METHOD && url.pathname.endsWith(SETTINGS_ROUTE_END);
    if (!isSettingsSave) return null;
    const file = context.kvFile as ReadableFile | null | undefined;
    const previous = file ? parsed(await file.read()) : null;
    const risky = newRiskyCommands(previous, parsed(await request.clone().text()));
    if (!risky.length) return null;
    const isKept = !context.remote && await confirm(risky, context);
    log(isKept ? TEXT.keptLog(risky.length) : TEXT.refusedLog(risky.length));
    return isKept ? null : refused();
  };
}

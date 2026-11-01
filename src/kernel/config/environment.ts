import { z } from 'zod';
import { CLIENT, FEATURE, MODE, type ClientId, type Mode } from '#shared/features/keys.ts';
import type { FeatureToggle } from '#shared/features/types.ts';
import { DEFAULT_LOG_FORMAT, LOG_FORMATS, type LogFormat, type LogLevel } from '#kernel/log/constants.ts';
import { DISABLED_VALUE, FALSE_VALUE, FEATURE_ON_SIGN, FEATURE_TOGGLE_LIST, FEATURE_TOGGLE_SEPARATOR, SIGN_LENGTH } from './constants.ts';
import { ARG, ENV } from './keys.ts';
import { parseLogLevel, type EnvironmentVariables } from './log-level.ts';
import { TEXT } from './text.ts';

export type Credentials = Readonly<{ login?: string; password?: string; pb2uid?: string }>;

export type Environment = Readonly<{
  client: ClientId;
  mode: Mode;
  gameDir: string | null;
  gameVersion: string | null;
  logLevel: LogLevel;
  logFormat: LogFormat;
  featureToggles: readonly FeatureToggle[];
  credentials: Credentials;
  listFeatures: boolean;
  args: readonly string[];
}>;

export type EnvironmentResult = Readonly<{ environment: Environment; problems: readonly string[] }>;

const optionalText = z.string().optional();
const environmentSchema = z.object({
  [ENV.gameDir]: optionalText,
  [ENV.gameVersion]: optionalText,
  [ENV.devConsole]: optionalText,
  [ENV.hooks]: optionalText,
  [ENV.features]: optionalText,
  [ENV.logFormat]: optionalText,
  [ENV.login]: optionalText,
  [ENV.password]: optionalText,
  [ENV.uid]: optionalText,
  [ENV.npmSadburst]: optionalText,
});

const isLogFormat = (value: string): value is LogFormat => (LOG_FORMATS as readonly string[]).includes(value);

export function clientOf(argv: readonly string[], npmSadburst: string | undefined): ClientId {
  const npmAskedForSadburst = npmSadburst !== undefined && npmSadburst !== FALSE_VALUE && npmSadburst !== DISABLED_VALUE;
  return argv.includes(ARG.sadburst) || npmAskedForSadburst ? CLIENT.sadburst : CLIENT.official;
}

function modeOf(argv: readonly string[]): Mode {
  if (argv.includes(ARG.remoteHost)) return MODE.remote;
  if (argv.includes(ARG.p2pHost)) return MODE.server;
  return MODE.local;
}

function featureTogglesOf(list: string | undefined, devConsole: string | undefined, hooks: string | undefined, problems: string[]): FeatureToggle[] {
  const toggles: FeatureToggle[] = [];
  if (devConsole === DISABLED_VALUE) toggles.push({ id: FEATURE.devConsole, on: false });
  if (hooks === DISABLED_VALUE) toggles.push({ id: FEATURE.hooks, on: false });
  if (!list) return toggles;
  if (!FEATURE_TOGGLE_LIST.test(list)) {
    problems.push(TEXT.badFeatureList(list));
    return toggles;
  }
  for (const item of list.split(FEATURE_TOGGLE_SEPARATOR)) toggles.push({ id: item.slice(SIGN_LENGTH), on: item.startsWith(FEATURE_ON_SIGN) });
  return toggles;
}

function logFormatOf(argv: readonly string[], fromEnv: string | undefined, problems: string[]): LogFormat {
  const fromArgs = argv.find((argument) => argument.startsWith(ARG.logFormatPrefix))?.slice(ARG.logFormatPrefix.length);
  const asked = fromArgs ?? fromEnv;
  if (asked === undefined) return DEFAULT_LOG_FORMAT;
  if (isLogFormat(asked)) return asked;
  problems.push(TEXT.unknownLogFormat(asked));
  return DEFAULT_LOG_FORMAT;
}

const nonEmpty = (value: string | undefined): string | null => (value ? value : null);

function credentialsOf(variables: z.infer<typeof environmentSchema>): Credentials {
  const pairs: [keyof Credentials, string | undefined][] = [['login', variables[ENV.login]], ['password', variables[ENV.password]], ['pb2uid', variables[ENV.uid]]];
  return Object.freeze(Object.fromEntries(pairs.filter(([, value]) => value)));
}

export function parseEnvironment(argv: readonly string[], env: EnvironmentVariables): EnvironmentResult {
  const problems: string[] = [];
  const variables = environmentSchema.parse(env);
  const logLevel = parseLogLevel(argv, env);
  if (logLevel.problem) problems.push(logLevel.problem);
  const environment: Environment = Object.freeze({
    client: clientOf(argv, variables[ENV.npmSadburst]),
    mode: modeOf(argv),
    gameDir: nonEmpty(variables[ENV.gameDir]),
    gameVersion: nonEmpty(variables[ENV.gameVersion]),
    logLevel: logLevel.level,
    logFormat: logFormatOf(argv, variables[ENV.logFormat], problems),
    featureToggles: Object.freeze(featureTogglesOf(variables[ENV.features], variables[ENV.devConsole], variables[ENV.hooks], problems)),
    credentials: credentialsOf(variables),
    listFeatures: argv.includes(ARG.listFeatures),
    args: Object.freeze([...argv]),
  });
  return Object.freeze({ environment, problems: Object.freeze(problems) });
}

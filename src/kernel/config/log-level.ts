import { DEFAULT_LOG_LEVEL, LOG_LEVEL, LOG_LEVELS, type LogLevel } from '#kernel/log/constants.ts';
import { ARG, ENV } from './keys.ts';
import { TEXT } from './text.ts';

export type EnvironmentVariables = Readonly<Record<string, string | undefined>>;
export type LogLevelChoice = Readonly<{ level: LogLevel; problem: string | null }>;

const isLogLevel = (value: string): value is LogLevel => (LOG_LEVELS as readonly string[]).includes(value);

function askedLevel(argv: readonly string[], env: EnvironmentVariables): string | null {
  let asked = env[ENV.logLevel] || null;
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index] ?? '';
    const next = argv[index + 1];
    if (argument === ARG.verbose || argument === ARG.verboseShort) asked = LOG_LEVEL.debug;
    else if (argument.startsWith(ARG.logLevelPrefix)) asked = argument.slice(ARG.logLevelPrefix.length);
    else if (argument === ARG.logLevel && next) {
      asked = next;
      index++;
    }
  }
  return asked;
}

export function parseLogLevel(argv: readonly string[], env: EnvironmentVariables): LogLevelChoice {
  const asked = askedLevel(argv, env);
  if (!asked) return { level: DEFAULT_LOG_LEVEL, problem: null };
  const level = asked.toLowerCase();
  if (isLogLevel(level)) return { level, problem: null };
  return { level: DEFAULT_LOG_LEVEL, problem: TEXT.unknownLogLevel(asked, DEFAULT_LOG_LEVEL) };
}

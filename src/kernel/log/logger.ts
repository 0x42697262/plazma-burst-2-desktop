import {
  CLOCK_FIELD_WIDTH, CLOCK_MILLISECONDS_WIDTH, CLOCK_SEPARATOR, DEFAULT_LOG_FORMAT, DEFAULT_LOG_LEVEL, FIELD_ASSIGN,
  FIELD_SEPARATOR, LOG_FORMAT, LOG_LEVEL, LOG_LEVELS, MILLISECONDS_SEPARATOR, PAD_CHARACTER, STAMPED_LOG_LEVEL,
  type LogFormat, type LogLevel,
} from './constants.ts';

export type LogFields = Readonly<Record<string, unknown>>;
export type LogOutput = { error(...parts: unknown[]): void; warn(...parts: unknown[]): void; log(...parts: unknown[]): void };

export type Logger = {
  readonly level: LogLevel;
  readonly format: LogFormat;
  on(level: LogLevel): boolean;
  error(...parts: unknown[]): void;
  warn(...parts: unknown[]): void;
  info(...parts: unknown[]): void;
  debug(...parts: unknown[]): void;
  event(level: LogLevel, name: string, fields?: LogFields): void;
};

const pad = (value: number, width: number = CLOCK_FIELD_WIDTH): string => String(value).padStart(width, PAD_CHARACTER);

export const clockOf = (moment: Date): string => [pad(moment.getHours()), pad(moment.getMinutes()), pad(moment.getSeconds())].join(CLOCK_SEPARATOR)
  + MILLISECONDS_SEPARATOR + pad(moment.getMilliseconds(), CLOCK_MILLISECONDS_WIDTH);

const fieldText = (value: unknown): string => (typeof value === 'string' ? value : JSON.stringify(value));

export const eventText = (name: string, fields: LogFields = {}): string => [name, ...Object.entries(fields).map(([key, value]) => key + FIELD_ASSIGN + fieldText(value))].join(FIELD_SEPARATOR);

export const eventJson = (level: LogLevel, name: string, fields: LogFields, moment: Date): string => JSON.stringify({ time: moment.toISOString(), level, event: name, ...fields });

const messageOf = (parts: readonly unknown[]): string => parts.map((part) => (typeof part === 'string' ? part : fieldText(part))).join(FIELD_SEPARATOR);

export function createLogger(level: LogLevel = DEFAULT_LOG_LEVEL, output: LogOutput = console, format: LogFormat = DEFAULT_LOG_FORMAT, now: () => Date = () => new Date()): Logger {
  const rank = LOG_LEVELS.indexOf(level);
  const on = (asked: LogLevel): boolean => LOG_LEVELS.indexOf(asked) <= rank;
  const isStamped = level === STAMPED_LOG_LEVEL;
  const writerOf = (asked: LogLevel): ((...parts: unknown[]) => void) => {
    if (asked === LOG_LEVEL.error) return output.error.bind(output);
    if (asked === LOG_LEVEL.warn) return output.warn.bind(output);
    return output.log.bind(output);
  };
  const print = (asked: LogLevel, parts: readonly unknown[]): void => {
    if (!on(asked)) return;
    const moment = now();
    if (format === LOG_FORMAT.json) {
      writerOf(asked)(eventJson(asked, '', { message: messageOf(parts) }, moment));
      return;
    }
    writerOf(asked)(...(isStamped ? [clockOf(moment)] : []), ...parts);
  };
  return {
    level,
    format,
    on,
    error: (...parts) => print(LOG_LEVEL.error, parts),
    warn: (...parts) => print(LOG_LEVEL.warn, parts),
    info: (...parts) => print(LOG_LEVEL.info, parts),
    debug: (...parts) => print(LOG_LEVEL.debug, parts),
    event(asked, name, fields = {}) {
      if (!on(asked)) return;
      const moment = now();
      if (format === LOG_FORMAT.json) writerOf(asked)(eventJson(asked, name, fields, moment));
      else print(asked, [eventText(name, fields)]);
    },
  };
}

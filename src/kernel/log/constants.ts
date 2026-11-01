export const LOG_LEVEL = Object.freeze({ error: 'error', warn: 'warn', info: 'info', debug: 'debug' });
export type LogLevel = typeof LOG_LEVEL[keyof typeof LOG_LEVEL];
export const LOG_LEVELS: readonly LogLevel[] = Object.freeze([LOG_LEVEL.error, LOG_LEVEL.warn, LOG_LEVEL.info, LOG_LEVEL.debug]);
export const DEFAULT_LOG_LEVEL: LogLevel = LOG_LEVEL.info;
export const STAMPED_LOG_LEVEL: LogLevel = LOG_LEVEL.debug;

export const LOG_FORMAT = Object.freeze({ text: 'text', json: 'json' });
export type LogFormat = typeof LOG_FORMAT[keyof typeof LOG_FORMAT];
export const LOG_FORMATS: readonly LogFormat[] = Object.freeze([LOG_FORMAT.text, LOG_FORMAT.json]);
export const DEFAULT_LOG_FORMAT: LogFormat = LOG_FORMAT.text;

export const CLOCK_FIELD_WIDTH = 2;
export const CLOCK_MILLISECONDS_WIDTH = 3;
export const PAD_CHARACTER = '0';
export const CLOCK_SEPARATOR = ':';
export const MILLISECONDS_SEPARATOR = '.';
export const FIELD_SEPARATOR = ' ';
export const FIELD_ASSIGN = '=';

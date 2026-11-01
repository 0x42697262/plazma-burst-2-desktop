import { LOG_FORMATS, LOG_LEVELS } from '#kernel/log/constants.ts';

export const TEXT = Object.freeze({
  unknownLogLevel: (asked: string, fallback: string) => `unknown log level "${asked}" (${LOG_LEVELS.join(', ')}); using ${fallback}`,
  unknownLogFormat: (asked: string) => `unknown log format "${asked}" (${LOG_FORMATS.join(', ')})`,
  badFeatureList: (value: string) => `PB2_FEATURES="${value}": expected +id or -id, separated by commas (e.g. "-hooks,-zoom")`,
  emptyValue: (name: string) => `${name} is set but empty`,
  problemReport: (problems: readonly string[]) => ['The app cannot start with these settings:', ...problems.map((problem) => `  - ${problem}`)].join('\n'),
});

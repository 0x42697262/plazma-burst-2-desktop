const ERROR_PREFIX = 'error: ';
const LINE_JOIN = ' | ';

export const errorsOf = (out: readonly string[]): string[] => out.filter((line) => line.startsWith(ERROR_PREFIX));
export const errorOf = (out: readonly string[]): string => out.find((line) => line.startsWith(ERROR_PREFIX)) ?? out.join(LINE_JOIN);

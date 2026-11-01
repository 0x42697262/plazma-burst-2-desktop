const ERROR_PREFIX = 'error: ';
const LINE_JOIN = ' | ';

type Lines = [string, ...string[]];

export const errorsOf = (out: readonly string[]): Lines => out.filter((line) => line.startsWith(ERROR_PREFIX)) as Lines;
export const errorOf = (out: readonly string[]): string => out.find((line) => line.startsWith(ERROR_PREFIX)) ?? out.join(LINE_JOIN);

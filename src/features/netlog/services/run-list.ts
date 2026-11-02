import type { RunEntry } from '../adapters/wrapper-client.ts';

let listed: readonly RunEntry[] = [];

export const rememberRuns = (runs: readonly RunEntry[]): void => { listed = runs; };
export const listedRun = (number: number): RunEntry | undefined => listed[number - 1];
export const listedRunCount = (): number => listed.length;

import { ROUTE } from '#shared/contract/routes.ts';
import { HTTP_POST, QUERY_START, RUN_QUERY } from '../keys.ts';
import type { LineSink } from '../services/recorder.ts';

export type RunEntry = { name: string; size: number; updated: number; active: boolean; mine: boolean; current: boolean };

const NO_STORE: RequestInit = { cache: 'no-store' };

async function textOrThrow(response: Response): Promise<string> {
  if (!response.ok) throw new Error(await response.text());
  return response.text();
}

export const wrapperLineSink: LineSink = {
  async send(body) {
    const response = await fetch(ROUTE.netLog, { method: HTTP_POST, body });
    if (!response.ok) throw new Error(await response.text());
    return await response.json() as { run: string; file: string };
  },
  beacon(body) {
    const canBeacon = typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function';
    if (!canBeacon) return false;
    navigator.sendBeacon(ROUTE.netLog, body);
    return true;
  },
};

export async function listRuns(): Promise<RunEntry[]> {
  const response = await fetch(ROUTE.netRuns, NO_STORE);
  return await response.json() as RunEntry[];
}

export async function readRun(name: string, lines: number): Promise<string> {
  const query = new URLSearchParams({ [RUN_QUERY.run]: name, [RUN_QUERY.lines]: String(lines) });
  return textOrThrow(await fetch(ROUTE.netRead + QUERY_START + query.toString(), NO_STORE));
}

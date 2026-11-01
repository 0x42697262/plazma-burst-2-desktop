import { ROUTE, withQuery } from '#shared/contract/routes.ts';
import { HTTP_METHOD, NO_STORE_CACHE } from '#shared/contract/keys.ts';
import { RUN_QUERY } from '../keys.ts';
import type { LineSink } from '../services/recorder.ts';

export type RunEntry = { name: string; size: number; updated: number; active: boolean; mine: boolean; current: boolean };

const NO_STORE: RequestInit = { cache: NO_STORE_CACHE };

async function textOrThrow(response: Response): Promise<string> {
  if (!response.ok) throw new Error(await response.text());
  return response.text();
}

export const wrapperLineSink: LineSink = {
  async send(body) {
    const response = await fetch(ROUTE.netLog, { method: HTTP_METHOD.post, body });
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
  return textOrThrow(await fetch(withQuery(ROUTE.netRead, { [RUN_QUERY.run]: name, [RUN_QUERY.lines]: String(lines) }), NO_STORE));
}

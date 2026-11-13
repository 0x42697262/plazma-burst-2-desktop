import fs from 'node:fs';
import path from 'node:path';
import { NOT_PUBLISHED, beautifyMap } from '#kernel/maps/map-text.ts';
import { stringOf } from '#kernel/text/text-of.ts';
import { mapBaseName, mapFileName, mapIdOfFile } from '#kernel/maps/file-name.ts';
import { MAP_LIMITS, MAP_TIMEOUT_MS } from './constants.ts';
import {
  BYTE_ORDER_MARK, HIDDEN_FILE, LOCAL_PREFIX, MAP_EXTENSIONS, MAP_REQUEST, NOT_A_MAP, PATH_SEPARATORS, POST_METHOD, TEXT_ENCODING, XML_START,
} from './keys.ts';
import { MAPS_TEXT as TEXT } from './text.ts';

export type MapAnswer = string | null;
export type MapSource = Readonly<{ name: string; fetchMap(id: string): Promise<MapAnswer> }>;
export type Maps = { list(): string[]; local(id: unknown): string | null; download(id: string): Promise<string | null> };
type Fetch = (url: string, init: RequestInit) => Promise<Response>;
type Clock = () => number;
type Sleep = (ms: number) => Promise<void>;

function readIn(folder: string, name: string): string | null {
  let files: string[];
  try {
    files = fs.readdirSync(folder);
  } catch {
    return null;
  }
  const wanted = name.toLowerCase();
  for (const extension of MAP_EXTENSIONS) {
    const hit = files.find((file) => file.toLowerCase() === wanted + extension && !file.startsWith(HIDDEN_FILE));
    if (hit) return fs.readFileSync(path.join(folder, hit), TEXT_ENCODING).replace(BYTE_ORDER_MARK, '').trim();
  }
  return null;
}

function mapFiles(folder: string): string[] {
  try {
    return fs.readdirSync(folder).filter((file) => !file.startsWith(HIDDEN_FILE) && MAP_EXTENSIONS.includes(path.extname(file).toLowerCase()));
  } catch {
    return [];
  }
}

function keep(mapsDir: string, id: string, xml: string): void {
  try {
    fs.mkdirSync(mapsDir, { recursive: true });
    fs.writeFileSync(path.join(mapsDir, mapFileName(id)), xml);
  } catch {
    return;
  }
}

const isNotPublished = (text: string): boolean => text.startsWith(NOT_PUBLISHED);

export const isMapText = (xml: string): boolean => xml.startsWith(XML_START) && !NOT_A_MAP.test(xml) && xml.length <= MAP_LIMITS.maxChars;

export function httpMapSource(name: string, url: string, fetch: Fetch = globalThis.fetch): MapSource {
  return Object.freeze({
    name,
    async fetchMap(id: string): Promise<MapAnswer> {
      const body = new URLSearchParams({ ...MAP_REQUEST, cmap: id });
      const response = await fetch(url, { method: POST_METHOD, body, signal: AbortSignal.timeout(MAP_TIMEOUT_MS) });
      if (!response.ok) throw new Error(TEXT.siteAnswered(response.status));
      const text = (await response.text()).replace(BYTE_ORDER_MARK, '').trim();
      return isNotPublished(text) ? null : text;
    },
  });
}

type SourceHealth = { failures: number; pausedUntil: number };

const defaultSleep: Sleep = (ms) => new Promise((resolve) => { setTimeout(resolve, ms); });

export function createMaps({ mapsDir, unpack, sources = [], clock = Date.now, sleep = defaultSleep }: {
  mapsDir: string; unpack: (text: string) => string; sources?: readonly MapSource[]; clock?: Clock; sleep?: Sleep;
}): Maps {
  const plain = (text: string | null): string | null => (text === null ? null : unpack(text));
  const missedAt = new Map<string, number>();
  const startedAt: number[] = [];
  const health = new Map<string, SourceHealth>(sources.map((source) => [source.name, { failures: 0, pausedUntil: 0 }]));
  let lastRequestAt = Number.NEGATIVE_INFINITY;
  let queue: Promise<unknown> = Promise.resolve();

  const isRememberedMiss = (key: string): boolean => {
    const at = missedAt.get(key);
    if (at === undefined) return false;
    if (clock() - at < MAP_LIMITS.missMemoryMs) return true;
    missedAt.delete(key);
    return false;
  };

  const takeStartSlot = (): void => {
    while (startedAt.length && clock() - (startedAt[0] ?? 0) >= MAP_LIMITS.windowMs) startedAt.shift();
    if (startedAt.length >= MAP_LIMITS.newMapsPerMinute) throw new Error(TEXT.tooManyNewMaps(MAP_LIMITS.newMapsPerMinute));
    startedAt.push(clock());
  };

  const failed = (source: MapSource, state: SourceHealth): void => {
    state.failures++;
    if (state.failures >= MAP_LIMITS.failuresBeforePause) {
      state.pausedUntil = clock() + MAP_LIMITS.pauseMs;
      state.failures = 0;
    }
    health.set(source.name, state);
  };

  async function askSources(id: string): Promise<string | null> {
    const problems: string[] = [];
    for (const source of sources) {
      const state = health.get(source.name) ?? { failures: 0, pausedUntil: 0 };
      if (clock() < state.pausedUntil) {
        problems.push(TEXT.sourcePaused(source.name));
        continue;
      }
      const waitMs = lastRequestAt + MAP_LIMITS.gapMs - clock();
      if (waitMs > 0) await sleep(waitMs);
      lastRequestAt = clock();
      let answer: MapAnswer;
      try {
        answer = await source.fetchMap(id);
      } catch (error) {
        problems.push(TEXT.sourceFailed(source.name, (error as Error).message));
        failed(source, state);
        continue;
      }
      if (answer === null) {
        health.set(source.name, { failures: 0, pausedUntil: 0 });
        return null;
      }
      const xml = beautifyMap(unpack(answer));
      if (!isMapText(xml.trim())) {
        problems.push(TEXT.notAMap(source.name));
        failed(source, state);
        continue;
      }
      health.set(source.name, { failures: 0, pausedUntil: 0 });
      return xml;
    }
    throw new Error(problems.length ? problems.join(TEXT.problemJoin) : TEXT.noSources);
  }

  return {
    list: () => [...new Set(mapFiles(mapsDir).map(mapIdOfFile))],
    local(id) {
      const wanted = stringOf(id || '').trim();
      const isUnsafe = !wanted || PATH_SEPARATORS.some((separator) => wanted.includes(separator)) || wanted.startsWith(HIDDEN_FILE);
      if (isUnsafe) return null;
      const name = wanted.toLowerCase().startsWith(LOCAL_PREFIX) ? wanted.slice(LOCAL_PREFIX.length) : wanted;
      return plain(readIn(mapsDir, name) || readIn(mapsDir, mapBaseName(wanted)));
    },
    download(id) {
      const key = id.toLowerCase();
      if (isRememberedMiss(key)) return Promise.resolve(null);
      try {
        takeStartSlot();
      } catch (error) {
        return Promise.reject(error instanceof Error ? error : new Error(String(error)));
      }
      const result = queue.then(async () => {
        const xml = await askSources(id);
        if (xml === null) missedAt.set(key, clock());
        else keep(mapsDir, id, xml);
        return xml;
      });
      queue = result.catch(() => undefined);
      return result;
    },
  };
}

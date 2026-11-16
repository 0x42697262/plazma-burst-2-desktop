import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { JSON_INDENT, WATCH_DELAY_MS } from './constants.ts';
import { EMPTY_OBJECT_TEXT, EXCLUSIVE_CREATE_FLAG, LINE_END, TEXT_ENCODING } from './keys.ts';
import { TEXT } from './text.ts';

type FolderWatch = { close(): void };
type WatchFolder = (folder: string, listener: (event: string, name: string | null) => void) => FolderWatch;
export type KvFileEvents = { onChange: (saved: Record<string, unknown>) => void; onError: (message: string) => void; watchDelayMs?: number; watchFolder?: WatchFolder };

const watchWithFs: WatchFolder = (folder, listener) => fsSync.watch(folder, (event, name) => { listener(event, name); });
export type KvFile = {
  read(): Promise<string>;
  peek(): Promise<string>;
  write(saved: unknown): Promise<boolean>;
  check(): Promise<void>;
  watch(): () => void;
};

export function seedKvFile(file: string, seed: Readonly<Record<string, unknown>>): boolean {
  if (!Object.keys(seed).length || fsSync.existsSync(file)) return false;
  fsSync.mkdirSync(path.dirname(file), { recursive: true });
  fsSync.writeFileSync(file, JSON.stringify(seed, null, JSON_INDENT) + LINE_END, { flag: EXCLUSIVE_CREATE_FLAG });
  return true;
}

const isPlainObject = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

export function createKvFile(file: string, { onChange, onError, watchDelayMs = WATCH_DELAY_MS, watchFolder = watchWithFs }: KvFileEvents): KvFile {
  let known: string | null = null;
  let stopWatching: (() => void) | null = null;
  let broken: string | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const readText = (): Promise<string | null> => fs.readFile(file, TEXT_ENCODING).catch(() => null);

  async function check(): Promise<void> {
    const text = await readText();
    if (text === null || text === known || text === broken) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
      if (!isPlainObject(parsed)) throw new Error(TEXT.expectedObject);
    } catch (error) {
      broken = text;
      onError((error as Error).message);
      return;
    }
    known = text;
    broken = null;
    onChange(parsed);
  }

  return {
    async read() {
      const text = await readText();
      if (text === null) return EMPTY_OBJECT_TEXT;
      known = text;
      return text;
    },
    async peek() {
      return (await readText()) ?? EMPTY_OBJECT_TEXT;
    },
    async write(saved) {
      const disk = await readText();
      const changedOnDisk = known !== null && disk !== null && disk !== known;
      if (changedOnDisk) {
        await check();
        return false;
      }
      known = JSON.stringify(saved, null, JSON_INDENT) + LINE_END;
      await fs.mkdir(path.dirname(file), { recursive: true });
      await fs.writeFile(file, known);
      return true;
    },
    check,
    watch() {
      if (stopWatching) return stopWatching;
      const watcher = watchFolder(path.dirname(file), (_event, name) => {
        if (name !== path.basename(file)) return;
        clearTimeout(timer);
        timer = setTimeout(() => { check().catch(() => undefined); }, watchDelayMs);
      });
      const stop = (): void => {
        clearTimeout(timer);
        watcher.close();
        stopWatching = null;
      };
      stopWatching = stop;
      return stop;
    },
  };
}

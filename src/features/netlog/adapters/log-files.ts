import fs from 'node:fs/promises';
import path from 'node:path';
import { FILE_ACTIVE_MS, POST_LINES_MAX, READ_LINES_MAX, READ_TAIL_BYTES } from '../constants.ts';
import { HIDDEN_FILE_PREFIX, DATE_LOCALE, EXCLUSIVE_CREATE_FLAG, EXISTS_ERROR_CODE, LINE_BREAK, LOG_FILE_EXTENSION, READ_FLAG, TEXT_ENCODING } from '../keys.ts';
import { FILE_TEXT } from '../text.ts';
import { STATUS } from '#wrapper/http/keys.ts';
import { cleanLine, fileHeader, instanceOfRun, isEventLine, isRunName, safeInstanceName, stampOf } from '../domain/log-file.ts';

export type RunInfo = { name: string; instance: string; size: number; updated: number; active: boolean; mine: boolean };
export type NetLogFiles = {
  append(instance: string, lines: unknown): Promise<string>;
  list(): Promise<RunInfo[]>;
  read(name: string, max?: number): Promise<string[]>;
  runName(instance: string): string | null;
  readonly runStamp: string;
  readonly dir: string;
};

type Writer = { instance: string; name: string | null; file: string | null; queue: Promise<unknown> };

export class StatusError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const isFileExistsError = (error: unknown): boolean => (error as NodeJS.ErrnoException | null)?.code === EXISTS_ERROR_CODE;

export function createNetLogFiles({ dir, version = '', now = () => new Date() }: { dir: string; version?: string; now?: () => Date }): NetLogFiles {
  const runStamp = stampOf(now());
  const writers = new Map<string, Writer>();
  const ownFiles = new Set<string>();

  function writerFor(instance: string): Writer {
    const name = safeInstanceName(instance);
    const existing = writers.get(name);
    if (existing) return existing;
    const writer: Writer = { instance: name, name: null, file: null, queue: Promise.resolve() };
    writers.set(name, writer);
    return writer;
  }

  async function create(writer: Writer): Promise<void> {
    await fs.mkdir(dir, { recursive: true });
    const head = fileHeader(now().toLocaleString(DATE_LOCALE), writer.instance, version, process.pid).join(LINE_BREAK);
    for (let attempt = 1; ; attempt++) {
      const name = FILE_TEXT.runFileName(runStamp, writer.instance, attempt);
      const file = path.join(dir, name + LOG_FILE_EXTENSION);
      try {
        await fs.writeFile(file, head, { flag: EXCLUSIVE_CREATE_FLAG });
        writer.name = name;
        writer.file = file;
        ownFiles.add(name);
        return;
      } catch (error) {
        if (!isFileExistsError(error)) throw error;
      }
    }
  }

  async function append(instance: string, lines: unknown): Promise<string> {
    if (!Array.isArray(lines)) throw new Error(FILE_TEXT.notAnArray);
    if (lines.length > POST_LINES_MAX) throw new Error(FILE_TEXT.tooManyLines(POST_LINES_MAX));
    const text = lines.map(cleanLine).join(LINE_BREAK);
    const writer = writerFor(instance);
    const done = writer.queue.then(async () => {
      if (!writer.file) await create(writer);
      if (text && writer.file) await fs.appendFile(writer.file, text + LINE_BREAK);
      return writer.name ?? '';
    });
    writer.queue = done.catch(() => undefined);
    return done;
  }

  async function list(): Promise<RunInfo[]> {
    let names: string[];
    try {
      names = await fs.readdir(dir);
    } catch {
      return [];
    }
    const time = now().getTime();
    const runs: RunInfo[] = [];
    for (const fileName of names) {
      const isLogFile = fileName.endsWith(LOG_FILE_EXTENSION) && !fileName.startsWith(HIDDEN_FILE_PREFIX);
      if (!isLogFile) continue;
      const name = fileName.slice(0, -LOG_FILE_EXTENSION.length);
      const stats = await fs.stat(path.join(dir, fileName)).catch(() => null);
      if (!stats?.isFile()) continue;
      runs.push({ name, instance: instanceOfRun(name), size: stats.size, updated: stats.mtimeMs, active: time - stats.mtimeMs < FILE_ACTIVE_MS, mine: ownFiles.has(name) });
    }
    return runs.sort((first, second) => second.name.localeCompare(first.name));
  }

  async function read(name: string, max: number = READ_LINES_MAX): Promise<string[]> {
    if (!isRunName(name)) throw new StatusError(FILE_TEXT.badRunName, STATUS.badRequest);
    const file = path.join(dir, name + LOG_FILE_EXTENSION);
    const handle = await fs.open(file, READ_FLAG).catch(() => { throw new StatusError(FILE_TEXT.noSuchRun(name), STATUS.notFound); });
    try {
      const { size } = await handle.stat();
      const start = Math.max(0, size - READ_TAIL_BYTES);
      const buffer = Buffer.alloc(size - start);
      await handle.read(buffer, 0, buffer.length, start);
      const lines = buffer.toString(TEXT_ENCODING).split(LINE_BREAK);
      if (start > 0) lines.shift();
      return lines.filter(isEventLine).slice(-Math.max(1, Math.min(max, READ_LINES_MAX)));
    } finally {
      await handle.close();
    }
  }

  const runName = (instance: string): string | null => writers.get(safeInstanceName(instance))?.name ?? null;

  return { append, list, read, runName, runStamp, dir };
}

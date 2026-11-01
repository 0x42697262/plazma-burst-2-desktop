import fs from 'node:fs';
import fsPromises from 'node:fs/promises';
import path from 'node:path';
import type { z } from 'zod';
import { JSON_INDENT, LINE_END, MISSING_FILE_CODE, TEMPORARY_SUFFIX, TEXT_ENCODING, UNVERSIONED, VERSION_FIELD } from './constants.ts';
import { TEXT } from './text.ts';

export type Migration = (data: Record<string, unknown>) => Record<string, unknown>;

export type VersionedFileOptions<Value extends Record<string, unknown>> = {
  file: string;
  version: number;
  schema: z.ZodType<Value>;
  migrations: Readonly<Record<number, Migration>>;
};

export type VersionedRead<Value> = { value: Value; migratedFrom: number | null };

export type VersionedFile<Value> = {
  readonly file: string;
  read(): Promise<VersionedRead<Value> | null>;
  readSync(): VersionedRead<Value> | null;
  write(value: Value): Promise<void>;
  writeSync(value: Value): void;
};

export class PersistError extends Error {}

const isMissingFile = (error: unknown): boolean => (error as NodeJS.ErrnoException | null)?.code === MISSING_FILE_CODE;

const isPlainObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

export const serializeVersioned = (version: number, value: Record<string, unknown>): string => JSON.stringify({ [VERSION_FIELD]: version, ...value }, null, JSON_INDENT) + LINE_END;

export function decodeVersioned<Value extends Record<string, unknown>>(text: string, options: VersionedFileOptions<Value>): VersionedRead<Value> {
  const { file, version: latestVersion, schema, migrations } = options;
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    throw new PersistError(TEXT.notJson(file, (error as Error).message));
  }
  if (!isPlainObject(parsed)) throw new PersistError(TEXT.notObject(file));
  const { [VERSION_FIELD]: storedVersion = UNVERSIONED, ...body } = parsed;
  if (typeof storedVersion !== 'number' || !Number.isInteger(storedVersion)) throw new PersistError(TEXT.badVersion(file));
  if (storedVersion > latestVersion) throw new PersistError(TEXT.futureVersion(file, storedVersion, latestVersion));
  let data: Record<string, unknown> = body;
  for (let fromVersion = storedVersion; fromVersion < latestVersion; fromVersion++) {
    const migrate = migrations[fromVersion];
    if (!migrate) throw new PersistError(TEXT.missingMigration(file, fromVersion));
    data = migrate(data);
  }
  const checked = schema.safeParse(data);
  if (!checked.success) throw new PersistError(TEXT.invalid(file, checked.error.message));
  return { value: checked.data, migratedFrom: storedVersion === latestVersion ? null : storedVersion };
}

export function createVersionedFile<Value extends Record<string, unknown>>(options: VersionedFileOptions<Value>): VersionedFile<Value> {
  const { file, version } = options;
  const temporaryFile = file + TEMPORARY_SUFFIX;
  const ensureFolder = (): void => { fs.mkdirSync(path.dirname(file), { recursive: true }); };

  async function write(value: Value): Promise<void> {
    await fsPromises.mkdir(path.dirname(file), { recursive: true });
    await fsPromises.writeFile(temporaryFile, serializeVersioned(version, value));
    await fsPromises.rename(temporaryFile, file);
  }

  function writeSync(value: Value): void {
    ensureFolder();
    fs.writeFileSync(temporaryFile, serializeVersioned(version, value));
    fs.renameSync(temporaryFile, file);
  }

  async function read(): Promise<VersionedRead<Value> | null> {
    let text: string;
    try {
      text = await fsPromises.readFile(file, TEXT_ENCODING);
    } catch (error) {
      if (isMissingFile(error)) return null;
      throw error;
    }
    const decoded = decodeVersioned(text, options);
    if (decoded.migratedFrom !== null) await write(decoded.value);
    return decoded;
  }

  function readSync(): VersionedRead<Value> | null {
    let text: string;
    try {
      text = fs.readFileSync(file, TEXT_ENCODING);
    } catch (error) {
      if (isMissingFile(error)) return null;
      throw error;
    }
    const decoded = decodeVersioned(text, options);
    if (decoded.migratedFrom !== null) writeSync(decoded.value);
    return decoded;
  }

  return { file, read, readSync, write, writeSync };
}

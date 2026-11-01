import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { stampOf } from '#kernel/time/stamp.ts';
import { createSerialQueue } from '#kernel/persist/serial.ts';
import { createVersionedFile } from '#kernel/persist/versioned.ts';
import { CODE_CHARS_MAX, ID_CHARS, INDEX_VERSION } from '../constants.ts';
import { CODE_EXTENSION, HASH_ALGORITHM, HASH_ENCODING, INDEX_FILE, KINDS, STATUS, TEXT_ENCODING, type FingerprintKind, type SaveStatus } from '../keys.ts';
import { STORE_TEXT } from '../text.ts';
import { shapeOf } from '../domain/shape.ts';

const versionSchema = z.object({ file: z.string(), kind: z.enum(['sync', 'async']), chars: z.number(), first: z.string(), last: z.string().nullable(), seen: z.number() });
const indexSchema = z.object({ latest: z.string().nullable(), versions: z.record(z.string(), versionSchema) });
type Index = z.infer<typeof indexSchema>;
export type VersionInfo = z.infer<typeof versionSchema>;

export type Saved = { id: string; file: string; status: SaveStatus };
export type Listed = VersionInfo & { id: string; latest: boolean };
export type Latest = VersionInfo & { id: string; code: string; versions: number };

export const versionId = (code: string): string => crypto.createHash(HASH_ALGORITHM).update(shapeOf(code)).digest(HASH_ENCODING).slice(0, ID_CHARS);

const emptyIndex = (): Index => ({ latest: null, versions: {} });
const isKind = (kind: unknown): kind is FingerprintKind => typeof kind === 'string' && KINDS.includes(kind);

export function createFingerprintStore({ dir, now = () => new Date() }: { dir: string; now?: () => Date }) {
  const serial = createSerialQueue();
  const indexFile = createVersionedFile<Index>({
    file: path.join(dir, INDEX_FILE),
    version: INDEX_VERSION,
    schema: indexSchema,
    migrations: { 0: (data) => ({ latest: typeof data.latest === 'string' ? data.latest : null, versions: data.versions ?? {} }) },
  });

  const readIndex = async (): Promise<Index> => {
    try {
      return (await indexFile.read())?.value ?? emptyIndex();
    } catch {
      return emptyIndex();
    }
  };
  const readCode = (file: string): Promise<string | null> => fs.readFile(path.join(dir, file), TEXT_ENCODING).catch(() => null);

  function save(code: unknown, kind: unknown): Promise<Saved> {
    return serial(async () => {
      if (typeof code !== 'string' || !code) throw new Error(STORE_TEXT.expectedSource);
      if (code.length > CODE_CHARS_MAX) throw new Error(STORE_TEXT.tooLong(CODE_CHARS_MAX));
      if (!isKind(kind)) throw new Error(STORE_TEXT.kindChoice(KINDS));
      await fs.mkdir(dir, { recursive: true });
      const index = await readIndex();
      const id = versionId(code);
      const moment = now();
      let version = index.versions[id];
      let status: SaveStatus = STATUS.same;
      if (!version) {
        version = { file: STORE_TEXT.fileName(stampOf(moment), id, CODE_EXTENSION), kind, chars: code.length, first: moment.toISOString(), last: null, seen: 0 };
        index.versions[id] = version;
        status = STATUS.new;
      } else if ((await readCode(version.file)) !== code) {
        status = STATUS.updated;
      }
      if (status !== STATUS.same) await fs.writeFile(path.join(dir, version.file), code);
      Object.assign(version, { kind, chars: code.length, last: moment.toISOString(), seen: version.seen + 1 });
      index.latest = id;
      await indexFile.write(index);
      return { id, file: version.file, status };
    });
  }

  async function list(): Promise<Listed[]> {
    const index = await readIndex();
    return Object.entries(index.versions)
      .map(([id, version]) => ({ id, ...version, latest: id === index.latest }))
      .sort((first, second) => (Number(second.latest) - Number(first.latest)) || String(second.last).localeCompare(String(first.last)));
  }

  async function latest(): Promise<Latest | null> {
    const index = await readIndex();
    const version = index.latest ? index.versions[index.latest] : undefined;
    if (!index.latest || !version) return null;
    const code = await readCode(version.file);
    if (code === null) return null;
    return { id: index.latest, ...version, code, versions: Object.keys(index.versions).length };
  }

  return { save, list, latest, dir };
}

export type FingerprintStore = ReturnType<typeof createFingerprintStore>;

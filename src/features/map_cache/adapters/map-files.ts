import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { MAP_MARKER, SAVE_RESULT } from '#shared/contract/keys.ts';
import type { SaveResult } from '#shared/contract/routes.ts';
import { makeUnpacker, beautifyMap } from '#kernel/maps/map-text.ts';
import { BYTE_ORDER_MARK, EXCLUSIVE_FLAG, EXISTS_ERROR_CODE, HIDDEN_PREFIX, MAP_EXTENSIONS, OVERWRITE_FLAG, SETTING, TEXT_ENCODING, XML_START } from '../keys.ts';
import { TEXT } from '../text.ts';
import { isEditedName, isLocalMapId, localMapId, mapFileName } from '../domain/map-id.ts';
import { StatusError } from '#wrapper/http/status-error.ts';
import { STATUS } from '#shared/contract/keys.ts';

export type MapFilesDeps = { dir: string; gameDir: string; kvFile: string; repoRoot: string; info: (message: string) => void };
export type MapFiles = ReturnType<typeof createMapFiles>;

const isExistsError = (error: unknown): boolean => (error as NodeJS.ErrnoException | null)?.code === EXISTS_ERROR_CODE;
const cleanText = (text: string): string => text.replace(BYTE_ORDER_MARK, '').trim();

export function createMapFiles({ dir, gameDir, kvFile, repoRoot, info }: MapFilesDeps) {
  const unpack = makeUnpacker(gameDir);
  const beautify = beautifyMap;

  function setting(name: string): unknown {
    try {
      return (JSON.parse(fsSync.readFileSync(kvFile, TEXT_ENCODING)) as Record<string, unknown> | null)?.[name];
    } catch {
      return undefined;
    }
  }
  const isSaving = (): boolean => setting(SETTING.save) !== false;
  const isFastLoading = (): boolean => setting(SETTING.fast) === true;

  async function save(rawId: string | null, raw: string | null): Promise<SaveResult> {
    if (!isSaving()) return SAVE_RESULT.off;
    const id = (rawId ?? '').trim();
    if (!id || isLocalMapId(id)) throw new Error(TEXT.noMapId);
    const text = unpack(cleanText(raw ?? ''));
    if (!text.startsWith(XML_START) || text.startsWith(MAP_MARKER.notPublished)) throw new Error(TEXT.notMapXml);
    const file = path.join(dir, mapFileName(id));
    const pretty = beautify(text);
    const existing = await fs.readFile(file, TEXT_ENCODING).catch(() => null);
    if (existing === pretty) return SAVE_RESULT.same;
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(file, pretty);
    info(TEXT.savedLog(id, file, text.length));
    return SAVE_RESULT.saved;
  }

  async function saveEdited(name: string | null, text: string, overwrite: boolean): Promise<{ file: string; id: string }> {
    if (!isEditedName(name)) throw new StatusError(TEXT.badName, STATUS.badRequest);
    if (!text.startsWith(XML_START)) throw new StatusError(TEXT.notMapXml, STATUS.badRequest);
    const file = path.join(dir, name + MAP_EXTENSIONS[0]);
    await fs.mkdir(dir, { recursive: true });
    try {
      await fs.writeFile(file, beautify(text), { flag: overwrite ? OVERWRITE_FLAG : EXCLUSIVE_FLAG });
    } catch (error) {
      if (isExistsError(error)) throw new StatusError(TEXT.exists(name), STATUS.conflict);
      throw error;
    }
    info(TEXT.savedEditedLog(file));
    return { file: path.relative(repoRoot, file), id: localMapId(name) };
  }

  const readSaved = (id: string | null): Promise<string | null> => fs.readFile(path.join(dir, mapFileName((id ?? '').trim())), TEXT_ENCODING).catch(() => null);

  async function listLocal(): Promise<string[]> {
    const files = await fs.readdir(dir).catch(() => [] as string[]);
    return files
      .filter((file) => MAP_EXTENSIONS.includes(path.extname(file).toLowerCase()) && !file.startsWith(HIDDEN_PREFIX))
      .map((file) => localMapId(path.basename(file, path.extname(file))));
  }

  async function findLocal(name: string): Promise<string | null> {
    const files = await fs.readdir(dir).catch(() => null);
    if (!files) return null;
    const wanted = name.toLowerCase();
    for (const extension of MAP_EXTENSIONS) {
      const hit = files.find((file) => file.toLowerCase() === wanted + extension);
      if (hit) return path.join(dir, hit);
    }
    return null;
  }

  const readLocal = async (file: string): Promise<string> => cleanText(await fs.readFile(file, TEXT_ENCODING));

  return { save, saveEdited, readSaved, listLocal, findLocal, readLocal, isFastLoading, dir, savedFileOf: (id: string) => path.join(dir, mapFileName(id)) };
}

import fs from 'node:fs/promises';
import path from 'node:path';
import { stampOf } from '#kernel/time/stamp.ts';
import { EXCLUSIVE_CREATE_FLAG, EXISTS_ERROR_CODE, shotFileName } from '../keys.ts';
import { TEXT } from '../text.ts';

export type CapturableWindow = { webContents: { capturePage(): Promise<{ toPNG(): Buffer }> } };

const isFileExistsError = (error: unknown): boolean => (error as NodeJS.ErrnoException | null)?.code === EXISTS_ERROR_CODE;

export async function saveWindowShot(window: CapturableWindow | null | undefined, dir: string, repoRoot: string, now: Date = new Date()): Promise<string> {
  if (!window) throw new Error(TEXT.noWindow);
  const png = (await window.webContents.capturePage()).toPNG();
  await fs.mkdir(dir, { recursive: true });
  const stamp = stampOf(now);
  for (let attempt = 1; ; attempt++) {
    const file = path.join(dir, shotFileName(stamp, attempt));
    try {
      await fs.writeFile(file, png, { flag: EXCLUSIVE_CREATE_FLAG });
      return path.relative(repoRoot, file);
    } catch (error) {
      if (!isFileExistsError(error)) throw error;
    }
  }
}

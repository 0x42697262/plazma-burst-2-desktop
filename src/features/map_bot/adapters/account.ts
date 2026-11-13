import fs from 'node:fs';
import path from 'node:path';
import { z } from 'zod';
import { ACCOUNT_FILE, ACCOUNT_FILE_VARIABLE, MD5_HEX, TEXT_ENCODING } from '../keys.ts';
import { TEXT } from '../text.ts';

export type BotAccount = Readonly<{ login: string; password: string }>;

const accountSchema = z.object({ login: z.string().min(1), password: z.string().regex(MD5_HEX) });

export const accountFileOf = (dataDir: string, env: NodeJS.ProcessEnv = process.env): string => env[ACCOUNT_FILE_VARIABLE] || path.join(dataDir, ACCOUNT_FILE);

export function readAccount(file: string): BotAccount {
  let text: string;
  try {
    text = fs.readFileSync(file, TEXT_ENCODING);
  } catch {
    throw new Error(TEXT.noAccount(file));
  }
  try {
    const parsed = accountSchema.parse(JSON.parse(text));
    return Object.freeze({ login: parsed.login, password: parsed.password });
  } catch (error) {
    throw new Error(TEXT.badAccount(file, (error as Error).message), { cause: error });
  }
}

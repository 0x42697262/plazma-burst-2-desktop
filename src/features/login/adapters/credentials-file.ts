import fs from 'node:fs';
import { BYTE_ORDER_MARK, TEXT_ENCODING } from '../constants.ts';

const isPlainObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

export function readCredentialsFile(file: string, report: (message: string) => void): Record<string, unknown> {
  if (!fs.existsSync(file)) return {};
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(file, TEXT_ENCODING).replace(BYTE_ORDER_MARK, ''));
    return isPlainObject(parsed) ? parsed : {};
  } catch (error) {
    report((error as Error).message);
    return {};
  }
}

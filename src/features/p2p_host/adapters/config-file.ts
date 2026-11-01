import fs from 'node:fs';
import { checkConfig, type CheckedConfig } from '../domain/config.ts';
import { CONFIG_TEXT } from '../text.ts';
import { BYTE_ORDER_MARK, MISSING_FILE_CODE, TEXT_ENCODING } from '../keys.ts';


export type LoadedConfig = CheckedConfig & { missing: boolean };

const failed = (errors: string[], missing: boolean): LoadedConfig => ({ match: null, server: null, problems: [], errors, missing });

export function loadConfig(file: string): LoadedConfig {
  let text: string;
  try {
    text = fs.readFileSync(file, TEXT_ENCODING);
  } catch (error) {
    const isMissing = (error as NodeJS.ErrnoException).code === MISSING_FILE_CODE;
    return isMissing ? failed([], true) : failed([CONFIG_TEXT.unreadable(file, (error as Error).message)], false);
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.replace(BYTE_ORDER_MARK, ''));
  } catch (error) {
    return failed([CONFIG_TEXT.notJson(file, (error as Error).message)], false);
  }
  return { ...checkConfig(parsed), missing: false };
}

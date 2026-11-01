import fs from 'node:fs/promises';
import path from 'node:path';
import { LINE_BREAK, LOG_FILE_EXTENSION, TEXT_ENCODING } from '../keys.ts';
import { TEMPORARY_SUFFIX } from '#kernel/persist/constants.ts';
import { redactLoggedLine } from '../domain/redact-line.ts';

export type RedactionReport = { files: number; changedFiles: number; changedLines: number };

export async function redactLogFolder(dir: string): Promise<RedactionReport> {
  const names = (await fs.readdir(dir).catch(() => [] as string[])).filter((name) => name.endsWith(LOG_FILE_EXTENSION));
  const report: RedactionReport = { files: names.length, changedFiles: 0, changedLines: 0 };
  for (const name of names) {
    const file = path.join(dir, name);
    const lines = (await fs.readFile(file, TEXT_ENCODING)).split(LINE_BREAK);
    const redacted = lines.map(redactLoggedLine);
    const changed = redacted.filter((line, index) => line !== lines[index]).length;
    if (!changed) continue;
    await fs.writeFile(file + TEMPORARY_SUFFIX, redacted.join(LINE_BREAK));
    await fs.rename(file + TEMPORARY_SUFFIX, file);
    report.changedFiles++;
    report.changedLines += changed;
  }
  return report;
}

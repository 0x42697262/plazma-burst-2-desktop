import fs from 'node:fs/promises';
import path from 'node:path';
import JavaScriptObfuscator from 'javascript-obfuscator';
import { NODE_EXTENSION, OBFUSCATED_EXTENSIONS, OBFUSCATOR_OPTIONS, SOURCE_MAP_EXTENSION } from './constants.ts';

export type SourceType = 'module' | 'script';

export const obfuscateCode = (code: string, sourceType: SourceType, file: string): string => JavaScriptObfuscator.obfuscate(code, {
  ...OBFUSCATOR_OPTIONS,
  sourceType,
  target: file.endsWith(NODE_EXTENSION) ? 'node' : 'browser',
}).getObfuscatedCode();

async function filesIn(output: string): Promise<string[]> {
  const stats = await fs.stat(output);
  if (!stats.isDirectory()) return [output];
  const entries = await fs.readdir(output, { recursive: true, withFileTypes: true });
  return entries.filter((entry) => entry.isFile()).map((entry) => path.join(entry.parentPath, entry.name));
}

export async function obfuscateOutputs(outputs: readonly string[], moduleOutputs: readonly string[]): Promise<string[]> {
  const obfuscated: string[] = [];
  for (const output of outputs) {
    const sourceType: SourceType = moduleOutputs.includes(output) ? 'module' : 'script';
    for (const file of await filesIn(output)) {
      if (file.endsWith(SOURCE_MAP_EXTENSION)) {
        await fs.rm(file, { force: true });
        continue;
      }
      if (!OBFUSCATED_EXTENSIONS.includes(path.extname(file))) continue;
      await fs.writeFile(file, obfuscateCode(await fs.readFile(file, 'utf8'), sourceType, file));
      await fs.rm(file + SOURCE_MAP_EXTENSION, { force: true });
      obfuscated.push(file);
    }
  }
  return obfuscated;
}

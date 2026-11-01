import fs from 'node:fs';
import path from 'node:path';
import { CLIENTS } from '#kernel/config/clients.ts';
import { STRINGS_FILE } from './keys.ts';
import { TEXT } from './text.ts';
import { findNames, gameVersion, render, type FoundNames } from './find-names.ts';

export type RunOptions = { gameDir?: string; out?: string; check?: boolean };

export function run(options: RunOptions = {}): FoundNames {
  const gameDir = path.resolve(options.gameDir || CLIENTS.official.gameDir);
  const out = path.resolve(options.out || CLIENTS.official.names);
  if (!fs.existsSync(path.join(gameDir, STRINGS_FILE))) throw new Error(TEXT.noGame(gameDir));
  const result = findNames(gameDir);
  const version = gameVersion(gameDir);
  const total = result.expected.length;
  console.log(TEXT.found(total - result.missing.length, total, gameDir, version));
  for (const problem of result.problems) console.log(TEXT.problem(problem));
  if (!options.check) {
    fs.writeFileSync(out, render(result, version));
    console.log(TEXT.wrote(path.relative(process.cwd(), out) || out));
  }
  return result;
}

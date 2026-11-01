import fs from 'node:fs';
import path from 'node:path';
import { LEGACY_FOLDERS_REMOVED_WHEN_EMPTY, LEGACY_MOVES, LEGACY_PREFIX_MOVES, type LegacyMove } from './keys.ts';
import { TEXT } from './text.ts';

export type MoveReport = Readonly<{ moved: string[]; problems: string[] }>;

export const NOTHING_MOVED: MoveReport = Object.freeze({ moved: [], problems: [] });

const filesWithPrefix = (root: string, fromDir: string, prefix: string): string[] => {
  try {
    return fs.readdirSync(path.join(root, fromDir)).filter((name) => name.startsWith(prefix));
  } catch {
    return [];
  }
};

const everyMove = (root: string): LegacyMove[] => [
  ...LEGACY_MOVES,
  ...LEGACY_PREFIX_MOVES.flatMap(({ fromDir, prefix, toDir }) =>
    filesWithPrefix(root, fromDir, prefix).map((name) => ({ from: path.posix.join(fromDir, name), to: path.posix.join(toDir, name) }))),
];

const removeIfEmpty = (folder: string): void => {
  try {
    fs.rmdirSync(folder);
  } catch {
    return;
  }
};

export function moveLegacyData(root: string): MoveReport {
  const moved: string[] = [];
  const problems: string[] = [];
  for (const { from, to } of everyMove(root)) {
    const source = path.join(root, from);
    const target = path.join(root, to);
    if (!fs.existsSync(source)) continue;
    if (fs.existsSync(target)) {
      problems.push(TEXT.bothExist(from, to));
      continue;
    }
    try {
      fs.mkdirSync(path.dirname(target), { recursive: true });
      fs.renameSync(source, target);
      moved.push(TEXT.moved(from, to));
    } catch (error) {
      problems.push(TEXT.notMoved(from, (error as Error).message));
    }
  }
  for (const folder of LEGACY_FOLDERS_REMOVED_WHEN_EMPTY) removeIfEmpty(path.join(root, folder));
  return { moved, problems };
}

export type MoveListener = Readonly<{ info(message: string): void; warn(message: string): void }>;

export const TERMINAL_LISTENER: MoveListener = Object.freeze({
  info: (message: string) => { console.warn(message); },
  warn: (message: string) => { console.warn(message); },
});

export function tellMoveReport({ moved, problems }: MoveReport, listener: MoveListener): void {
  for (const line of moved) listener.info(line);
  for (const line of problems) listener.warn(line);
}

export function moveLegacyDataAndTell(root: string, listener: MoveListener = TERMINAL_LISTENER): void {
  tellMoveReport(moveLegacyData(root), listener);
}

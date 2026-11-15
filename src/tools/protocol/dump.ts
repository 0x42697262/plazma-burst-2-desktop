import fs from 'node:fs';
import path from 'node:path';
import { decode, gameVersion, loadStrings } from '#tools/find-names/find-names.ts';
import { TEXT_ENCODING } from '#tools/find-names/keys.ts';
import { DISPATCH_USE, FLASH_SUFFIX, GAME_FOLDER, LINE_JOIN, LINE_SPLIT, NO_SENDERS, OPCODE_ASSIGNMENT, SCANNED_FILES, SENDER_SEPARATOR, TABLE_HEADER, TEXT } from './keys.ts';

type Source = { file: string; lines: string[] };
export type Message = { index: number; name: string; opcodeLine: number; dispatchLine: number | null; senders: { file: string; line: number }[] };

const readSources = (gameDir: string): Source[] => {
  const strings = loadStrings(gameDir);
  return SCANNED_FILES.map((file) => ({
    file,
    lines: decode(fs.readFileSync(path.join(gameDir, file), TEXT_ENCODING), strings).split(LINE_SPLIT),
  }));
};

const flashOf = (sources: readonly Source[]): Source => {
  const flash = sources.find((source) => source.file.endsWith(FLASH_SUFFIX));
  if (!flash) throw new Error(TEXT.noGame(GAME_FOLDER));
  return flash;
};

const opcodesOf = (flash: Source): { name: string; line: number }[] => {
  const found: { name: string; line: number }[] = [];
  flash.lines.forEach((line, index) => {
    const match = line.match(OPCODE_ASSIGNMENT);
    if (match?.[1]) found.push({ name: match[1], line: index + 1 });
  });
  return found;
};

const dispatchLinesOf = (flash: Source): Map<string, number> => {
  const lines = new Map<string, number>();
  flash.lines.forEach((line, index) => {
    const match = line.match(DISPATCH_USE);
    if (match?.[1] && !lines.has(match[1])) lines.set(match[1], index + 1);
  });
  return lines;
};

const sendersOf = (sources: readonly Source[], name: string, dispatchLine: number | null, flashFile: string): { file: string; line: number }[] => {
  const senders: { file: string; line: number }[] = [];
  for (const source of sources) {
    source.lines.forEach((line, index) => {
      if (!line.includes(name)) return;
      const here = index + 1;
      if (OPCODE_ASSIGNMENT.test(line) || DISPATCH_USE.test(line)) return;
      if (source.file === flashFile && here === dispatchLine) return;
      senders.push({ file: source.file, line: here });
    });
  }
  return senders;
};

export const messages = (gameDir: string): Message[] => {
  const sources = readSources(gameDir);
  const flash = flashOf(sources);
  const dispatchLines = dispatchLinesOf(flash);
  return opcodesOf(flash).map(({ name, line }, index) => {
    const dispatchLine = dispatchLines.get(name) ?? null;
    return { index, name, opcodeLine: line, dispatchLine, senders: sendersOf(sources, name, dispatchLine, flash.file) };
  });
};

export const render = (gameDir: string): string => {
  const out: string[] = [TEXT.title, '', TEXT.generated(gameVersion(gameDir)), '', TEXT.note, '', TABLE_HEADER];
  for (const message of messages(gameDir)) {
    const senders = message.senders.length
      ? message.senders.map((sender) => TEXT.sender(sender.file, sender.line)).join(SENDER_SEPARATOR)
      : NO_SENDERS;
    out.push(TEXT.row(message.index, message.name, message.opcodeLine, message.dispatchLine, senders));
  }
  out.push('');
  return out.join(LINE_JOIN);
};

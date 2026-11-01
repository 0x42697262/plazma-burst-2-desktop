import { stringOf } from '#kernel/text/text-of.ts';
import {
  ACTION_END, ACTION_START, HEADERS, HEADER_LINE, HEADER_SEPARATOR, LINE_BREAK, LINE_SPLIT, NAME_END, OPCODES_GLOBAL, OP_NUMBER, SCRIPT_MARK, TARGET_SEPARATOR,
  WHITESPACE, WORDS,
} from './keys.ts';
import { SCRIPT_TEXT as TEXT } from './text.ts';

export type ActionInfo = { desc: string; a: string; b: string; alias?: string };
type Opcodes = { actions?: Record<string, ActionInfo>; aliases: Record<string, number> };
export type ScriptAction = { line: number; name: string; type: number; A: string; B: string };
export type Script = { headers: Record<string, string>; actions: ScriptAction[] };

const OPCODES = (Reflect.get(globalThis, OPCODES_GLOBAL) as Opcodes | undefined) || null;

export const opcodesLoaded = (): boolean => !!OPCODES;
export const actionInfo = (type: number): ActionInfo | undefined => OPCODES?.actions?.[type];
export const opcodeName = (type: number): string => actionInfo(type)?.alias || TEXT.opName(type);
export const opcodeNames = (): string[] => (OPCODES ? Object.keys(OPCODES.aliases) : []);

export function opcodeType(name: string): number | null {
  const number = OP_NUMBER.exec(name)?.[1];
  if (number !== undefined) return Number(number);
  return OPCODES && Object.hasOwn(OPCODES.aliases, name) ? OPCODES.aliases[name] ?? null : null;
}

function similarNames(name: string): string[] {
  if (!OPCODES) return [];
  const squash = (text: string): string => text.toLowerCase().replace(WHITESPACE, '');
  return Object.keys(OPCODES.aliases).filter((alias) => squash(alias) === squash(name));
}

export const looksLikeScript = (text: string): boolean => SCRIPT_MARK.test(text) && text.includes(ACTION_END);

function linesOf(text: string): string[] {
  if (LINE_BREAK.test(text)) return text.split(LINE_SPLIT).map((line) => line.trim());
  let rest = text.trim();
  const lines: string[] = [];
  for (let header = HEADER_LINE.exec(rest); header; header = HEADER_LINE.exec(rest)) {
    lines.push(TEXT.headerLine(header[1] ?? '', header[2] ?? ''));
    rest = rest.slice(header[0].length);
  }
  for (let end = rest.indexOf(ACTION_END); end !== -1; end = rest.indexOf(ACTION_END)) {
    lines.push(rest.slice(0, end + ACTION_END.length).trim());
    rest = rest.slice(end + ACTION_END.length).trim();
  }
  if (rest) lines.push(rest);
  return lines;
}

function unknownActionHint(name: string): string {
  const like = similarNames(name);
  if (like.length) return TEXT.didYouMean(like);
  return OPCODES ? TEXT.searchHint : TEXT.notLoaded;
}

export function parseScript(text: unknown): Script {
  const headers: Record<string, string> = {};
  const actions: ScriptAction[] = [];
  linesOf(stringOf(text)).forEach((line, position) => {
    const lineNumber = position + 1;
    const where = TEXT.where(lineNumber, line);
    const start = line.indexOf(ACTION_START);
    const separator = line.indexOf(TARGET_SEPARATOR);
    const end = line.indexOf(ACTION_END);
    if (start !== -1 && separator !== -1 && end !== -1) {
      if (!(start < separator && separator < end)) throw new Error(TEXT.expectedAction(where));
      const name = line.slice(0, line.indexOf(NAME_END)).trim();
      const type = opcodeType(name);
      if (type === null) throw new Error(TEXT.unknownAction(where, name, unknownActionHint(name)));
      actions.push({ line: lineNumber, name, type, A: line.slice(start + ACTION_START.length, separator), B: line.slice(separator + TARGET_SEPARATOR.length, end) });
    } else if (line.includes(HEADER_SEPARATOR)) {
      const colon = line.indexOf(HEADER_SEPARATOR);
      const key = line.slice(0, colon).trim().toLowerCase();
      if (!HEADERS.includes(key)) throw new Error(TEXT.notHeader(where, key, HEADERS));
      headers[key] = line.slice(colon + 1).trim();
    } else if (line) {
      throw new Error(TEXT.notActionOrHeader(where, HEADERS));
    }
  });
  if (!actions.length) throw new Error(TEXT.noActions);
  return { headers, actions };
}

export function searchActions(query: unknown): (ActionInfo & { type: number })[] {
  if (!OPCODES?.actions) return [];
  const words = stringOf(query).toLowerCase().split(WORDS).filter(Boolean);
  return Object.entries(OPCODES.actions)
    .map(([type, info]) => ({ type: Number(type), ...info }))
    .filter((info) => words.every((word) => String(info.type) === word || TEXT.searchText(info.alias || '', info.type, info.desc).toLowerCase().includes(word)))
    .sort((first, second) => first.type - second.type);
}

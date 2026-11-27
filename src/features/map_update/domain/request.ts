import { CHAT_COMMAND, MATCH_MARK, NOW_WORD, TARGET_KIND, UPDATE_WORD, WORDS } from '../keys.ts';

export type Target = Readonly<{ kind: typeof TARGET_KIND.map; id: string }> | Readonly<{ kind: typeof TARGET_KIND.match; word: string }>;
export type TerminalRequest = Readonly<{ target: Target; now: boolean }>;
export type ChatRequest = Readonly<{ now: boolean }>;

const wordsOf = (text: string): string[] => text.trim().split(WORDS).filter(Boolean);
const isNow = (word: string | undefined): boolean => word?.toLowerCase() === NOW_WORD;

function targetOf(word: string): Target | null {
  if (!word.startsWith(MATCH_MARK)) return { kind: TARGET_KIND.map, id: word };
  const number = word.slice(MATCH_MARK.length);
  return number ? { kind: TARGET_KIND.match, word: number } : null;
}

export function terminalRequest(rest: string): TerminalRequest | null {
  const [verb, which, extra, ...more] = wordsOf(rest);
  const hasOnlyNow = extra === undefined || isNow(extra);
  if (verb?.toLowerCase() !== UPDATE_WORD || which === undefined || isNow(which) || !hasOnlyNow || more.length) return null;
  const target = targetOf(which);
  return target ? { target, now: isNow(extra) } : null;
}

export function chatRequest(text: string): ChatRequest | null {
  const [command, extra, ...more] = wordsOf(text);
  if (command?.toLowerCase() !== CHAT_COMMAND || more.length || (extra !== undefined && !isNow(extra))) return null;
  return { now: isNow(extra) };
}

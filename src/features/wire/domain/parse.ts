import { DEFAULT_RULE, FLAG, RELIABLE_PREFIX, TOKEN } from '../keys.ts';
import { WIRE_TEXT as TEXT } from '../text.ts';
import { MESSAGES } from './constants.ts';
import type { Field, Message } from './types.ts';

export type Flags = Readonly<{ dry: boolean; raw: boolean; force: boolean }>;
export type Parsed = Readonly<{ message: Message; assignments: ReadonlyMap<string, string>; flags: Flags }>;

const normalize = (name: string): string => name.toLowerCase().replace(RELIABLE_PREFIX, '');

const FLAG_VALUES: ReadonlySet<string> = new Set(Object.values(FLAG));

export function resolveMessage(word: string): Message {
  const wanted = normalize(word);
  const exact = MESSAGES.find((message) => normalize(message.name) === wanted);
  if (exact) return exact;
  const prefixed = MESSAGES.filter((message) => normalize(message.name).startsWith(wanted));
  if (prefixed.length === 1 && prefixed[0]) return prefixed[0];
  const names = (prefixed.length ? prefixed : MESSAGES).map((message) => message.name.toLowerCase());
  throw new Error(prefixed.length ? TEXT.ambiguousMessage(word, names) : TEXT.unknownMessage(word, names));
}

const allFields = (message: Message): readonly Field[] => [...message.fields, ...(message.group ?? [])];

export function parseArgs(args: readonly string[]): Parsed {
  const message = resolveMessage(args[0] ?? '');
  const fields = allFields(message);
  const assignments = new Map<string, string>();
  const flags = { dry: false, raw: false, force: false };
  const positionals: string[] = [];
  for (const token of args.slice(1)) {
    if (token.startsWith(TOKEN.flagPrefix)) {
      const flag = token.slice(TOKEN.flagPrefix.length).toLowerCase();
      if (!FLAG_VALUES.has(flag)) throw new Error(TEXT.unknownFlag(token, [...FLAG_VALUES]));
      flags[flag as keyof typeof flags] = true;
      continue;
    }
    const at = token.indexOf(TOKEN.assign);
    if (at !== -1) {
      const key = token.slice(0, at).toLowerCase();
      if (!fields.some((field) => field.name.toLowerCase() === key)) {
        throw new Error(TEXT.unknownField(key, message.name, fields.map((field) => field.name)));
      }
      assignments.set(key, token.slice(at + TOKEN.assign.length));
      continue;
    }
    positionals.push(token);
  }
  const fillable = message.fields.filter((field) => field.default !== DEFAULT_RULE.replyId && !assignments.has(field.name.toLowerCase()));
  if (positionals.length > fillable.length) throw new Error(TEXT.tooManyValues(message.name, fillable.length));
  positionals.forEach((value, index) => { const field = fillable[index]; if (field) assignments.set(field.name.toLowerCase(), value); });
  return { message, assignments, flags };
}

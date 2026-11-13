import path from 'node:path';
import { MAX_NICKNAME, MAX_PASSWORD } from '../constants.ts';
import { BINARY_TYPE, CONTENT_TYPES, DEFAULT_HTTPS_PORT, FORM_FIELD, HIDDEN_PREFIX, HTML_ESCAPES, HTML_SPECIAL, PATH_PARENT, PATH_SEPARATORS, PORT_SEPARATOR } from '../keys.ts';
import { TEXT } from '../text.ts';

export type JoinForm = Readonly<{ nickname: string; password: string }>;
export type FormResult = Readonly<{ form: JoinForm | null; problem: string | null }>;

export function readJoinForm(body: string): FormResult {
  const fields = new URLSearchParams(body);
  const nickname = (fields.get(FORM_FIELD.nickname) ?? '').trim();
  const password = fields.get(FORM_FIELD.password) ?? '';
  if (!nickname) return { form: null, problem: TEXT.needsNickname };
  if (nickname.length > MAX_NICKNAME || password.length > MAX_PASSWORD) return { form: null, problem: TEXT.tooLong };
  return { form: Object.freeze({ nickname, password }), problem: null };
}

export function safeRelativePath(urlPath: string): string | null {
  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  const parts = decoded.split(PATH_SEPARATORS).filter(Boolean);
  const isUnsafe = parts.some((part) => part === PATH_PARENT || part.startsWith(HIDDEN_PREFIX));
  return isUnsafe ? null : parts.join(path.sep);
}

export const contentTypeOf = (file: string): string => CONTENT_TYPES[path.extname(file).toLowerCase()] ?? BINARY_TYPE;

export const escapeHtml = (text: string): string => text.replace(HTML_SPECIAL, (character) => HTML_ESCAPES[character] ?? character);

export function lobbyHostOf(publicUrl: string, requestHost: string | undefined): string {
  if (!publicUrl) return requestHost ?? '';
  const url = new URL(publicUrl);
  return url.port && url.port !== DEFAULT_HTTPS_PORT ? url.hostname + PORT_SEPARATOR + url.port : url.hostname;
}

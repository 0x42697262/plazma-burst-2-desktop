import { NAME_MAX } from '../constants.ts';
import { FINGERPRINT_PATTERN, NICKNAME_PATTERN, SERVER_ID_PATTERN } from '../keys.ts';
import { ENTRY_TEXT } from '../text.ts';
import { parseAddress, normalFingerprint, type Address } from './address.ts';

export type ServerEntry = Address & { id: string; name: string; address: string; fingerprint: string; nickname: string; password: string };
export type StoredServer = Pick<ServerEntry, 'id' | 'name' | 'address' | 'fingerprint' | 'nickname' | 'password'>;
export type ShownServer = Pick<ServerEntry, 'id' | 'name' | 'address' | 'fingerprint' | 'nickname'> & { hasPassword: boolean };
export type CheckedServer = { server: ServerEntry | null; errors: string[] };
export type SaveRequest = { id?: unknown; name?: unknown; address?: unknown; fingerprint?: unknown; nickname?: unknown; password?: unknown };

const isPlainObject = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const textOf = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

export function checkServer(input: unknown, newId: () => string): CheckedServer {
  if (!isPlainObject(input)) return { server: null, errors: [ENTRY_TEXT.notAnEntry] };
  const errors: string[] = [];
  let address: Address | null = null;
  try {
    address = parseAddress(input.address);
  } catch (error) {
    errors.push((error as Error).message);
  }
  const fingerprint = normalFingerprint(input.fingerprint);
  if (!FINGERPRINT_PATTERN.test(fingerprint)) errors.push(ENTRY_TEXT.badFingerprint);
  const nickname = textOf(input.nickname);
  if (!NICKNAME_PATTERN.test(nickname)) errors.push(ENTRY_TEXT.badNickname);
  if (input.password !== undefined && typeof input.password !== 'string') errors.push(ENTRY_TEXT.badPassword);
  if (errors.length || !address) return { server: null, errors };
  const name = textOf(input.name).slice(0, NAME_MAX);
  const id = typeof input.id === 'string' && SERVER_ID_PATTERN.test(input.id) ? input.id : newId();
  const password = typeof input.password === 'string' ? input.password : '';
  return { server: { id, name: name || address.hostPort, address: address.hostPort, ...address, fingerprint, nickname, password }, errors };
}

export const storedServer = ({ id, name, address, fingerprint, nickname, password }: ServerEntry): StoredServer => ({ id, name, address, fingerprint, nickname, password });

export const shownServer = (server: ServerEntry): ShownServer => ({
  id: server.id, name: server.name, address: server.address, fingerprint: server.fingerprint, nickname: server.nickname, hasPassword: !!server.password,
});

export function passwordSurvivesEdit(previous: ServerEntry, request: SaveRequest): boolean {
  let nextAddress: string;
  try {
    nextAddress = parseAddress(request.address).hostPort;
  } catch {
    return false;
  }
  const keepsAddress = nextAddress === previous.hostPort;
  const keepsCertificate = normalFingerprint(request.fingerprint) === previous.fingerprint;
  return keepsAddress && keepsCertificate;
}

export type EditPassword = { password: string; dropped: boolean };

export function passwordForSave(previous: ServerEntry | null, request: SaveRequest): EditPassword {
  if (typeof request.password === 'string') return { password: request.password, dropped: false };
  if (!previous) return { password: '', dropped: false };
  const survives = passwordSurvivesEdit(previous, request);
  return { password: survives ? previous.password : '', dropped: !survives && !!previous.password };
}

import crypto from 'node:crypto';
import { decodeNumber } from '#console/kernel/net/codec.ts';
import { BETWEEN_MATCHES_MS, DEVICE_PART_BYTES, DEVICE_PARTS, LOGIN_TO_CREATE_MS, MAP_WAIT_MS, POLL_MS, SESSION_TIMEOUT_MS, TITLE_RANDOM_CHARS } from '../constants.ts';
import { BASE_36, DEVICE_SEPARATOR, LOBBY_CLIENT, MESSAGE, PASSWORD_BYTES, PASSWORD_ENCODING, REPLY_PLACEHOLDER, TASK_MESSAGES } from '../keys.ts';
import { TEXT } from '../text.ts';
import { collectMapPieces, isNotPublished, privateMatchPreset, replyOf } from '../domain/lobby.ts';
import type { BotAccount } from '../adapters/account.ts';
import type { LobbyClient, ReliableMessage } from '../adapters/lobby-client.ts';

export type FetchMapDeps = Readonly<{
  connect: () => LobbyClient;
  account: BotAccount;
  sleep: (ms: number) => Promise<void>;
  onTask?: () => void;
}>;

const randomTag = (length: number): string => crypto.randomBytes(length).toString(PASSWORD_ENCODING).slice(0, length).toLowerCase();
const deviceId = (): string => JSON.stringify(Array.from({ length: DEVICE_PARTS }, () => crypto.randomBytes(DEVICE_PART_BYTES).readUIntBE(0, DEVICE_PART_BYTES).toString(BASE_36)).join(DEVICE_SEPARATOR));

function withTimeout<Value>(promise: Promise<Value>, ms: number, message: string): Promise<Value> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_resolve, reject) => { timer = setTimeout(() => { reject(new Error(message)); }, ms); });
  return Promise.race([promise, timeout]).finally(() => { clearTimeout(timer); });
}

async function waitFor<Value>(read: () => Value | null, ms: number, sleep: (ms: number) => Promise<void>): Promise<Value | null> {
  for (let waited = 0; waited <= ms; waited += POLL_MS) {
    const value = read();
    if (value !== null) return value;
    await sleep(POLL_MS);
  }
  return null;
}

export async function fetchMapFromLobby(id: string, { connect, account, sleep, onTask }: FetchMapDeps): Promise<string | null> {
  const client = connect();
  const pieces = collectMapPieces();
  client.onMessage((message: ReliableMessage) => {
    if (TASK_MESSAGES.includes(message.type)) onTask?.();
    if (message.type !== MESSAGE.mapChunk) return;
    const [, index, total, text] = message.parts;
    pieces.add(decodeNumber(index, message.digits) ?? 0, decodeNumber(total, message.digits) ?? 0, text ?? '');
  });
  try {
    const login = replyOf(await withTimeout(client.ask([
      MESSAGE.authenticate, account.login, account.password, LOBBY_CLIENT.version, LOBBY_CLIENT.hash, REPLY_PLACEHOLDER, account.login, deviceId(), LOBBY_CLIENT.build,
    ]), SESSION_TIMEOUT_MS, TEXT.timedOut));
    if (!login.ok) throw new Error(TEXT.loginRefused(login.detail));
    await sleep(LOGIN_TO_CREATE_MS);
    const preset = privateMatchPreset(id, randomTag(PASSWORD_BYTES), randomTag(TITLE_RANDOM_CHARS));
    const created = replyOf(await withTimeout(client.ask([MESSAGE.createMatch, JSON.stringify(preset), REPLY_PLACEHOLDER]), SESSION_TIMEOUT_MS, TEXT.timedOut));
    if (!created.ok) {
      if (isNotPublished(created.detail)) return null;
      throw new Error(TEXT.createRefused(created.detail));
    }
    const map = await waitFor(() => pieces.complete(), MAP_WAIT_MS, sleep);
    if (map === null) throw new Error(TEXT.noMap);
    return map;
  } finally {
    client.close();
  }
}

export function pacedFetcher(fetchOne: (id: string) => Promise<string | null>, { clock, sleep }: { clock: () => number; sleep: (ms: number) => Promise<void> }) {
  let lastMatchAt = Number.NEGATIVE_INFINITY;
  return async (id: string): Promise<string | null> => {
    const waitMs = lastMatchAt + BETWEEN_MATCHES_MS - clock();
    if (waitMs > 0) await sleep(waitMs);
    lastMatchAt = clock();
    return fetchOne(id);
  };
}

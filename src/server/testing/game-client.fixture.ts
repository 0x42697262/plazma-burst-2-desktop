import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const GAME_SCRIPTS_IN_LOAD_ORDER = ['_strings.js', 'scripts/libs/socket.io.min.js', 'scripts/libs/tools.js', 'scripts/libs/xml.js', 'scripts/connection.js', 'scripts/libs/flash.js'];
const CONNECTION_SCRIPT = 'scripts/connection.js';
const TICK_MS = 16;
const CHAT_TO_EVERYONE_NOT_TEAM = 1;
const ANTI_CHEAT_GUARD_PAIR_NOTHING_TO_GUARD_HERE = ['$pМоcT', '$oеeес'];
const ignored = () => undefined;

export type GameClient = {
  net: any;
  conn: any;
  chat: string[];
  errors: string[];
  run(code: string): any;
  ask(parts: unknown[]): Promise<any[]>;
  login(login: string, password: string): Promise<any[]>;
  list(): Promise<any[]>;
  create(settings: unknown): Promise<any[]>;
  join(uid: unknown, password?: string): Promise<any[]>;
  say(text: string): void;
  closed(): boolean;
  close(): void;
};

const reliableMessageHandlerName = (gameDir: string, netName: string): string => {
  const escapedNet = netName.replace(/[$]/g, '\\$');
  const obfuscatedName = '\\$[0-9A-Za-z_\\u0400-\\u04FF]+';
  const handlerCall = new RegExp(`${escapedNet}\\.(${obfuscatedName})\\(this\\.${obfuscatedName}\\[0\\],this\\)`);
  const found = fs.readFileSync(path.join(gameDir, CONNECTION_SCRIPT), 'utf8').match(handlerCall)?.[1];
  if (!found) throw new Error(`no reliable message handler in ${CONNECTION_SCRIPT}`);
  return found;
};

export function createClient({ gameDir, names, url }: { gameDir: string; names: any; url: string }): GameClient {
  const chat: string[] = [];
  const context: Record<string, any> = {
    console: { log: ignored, warn: ignored, error: ignored, info: ignored, debug: ignored },
    setTimeout, clearTimeout, setInterval, clearInterval, performance, URL, URLSearchParams, TextEncoder, TextDecoder, WebSocket,
    location: { hash: '', href: 'https://www.plazmaburst2.com/', protocol: 'https:', hostname: 'www.plazmaburst2.com' },
    navigator: { userAgent: 'pb2-test-client' },
  };
  context.globalThis = context;
  context.window = context;
  context.self = context;
  vm.createContext(context);
  for (const script of GAME_SCRIPTS_IN_LOAD_ORDER) vm.runInContext(fs.readFileSync(path.join(gameDir, script), 'utf8'), context, { filename: script });
  const run = (code: string): any => vm.runInContext(code, context);
  const whatFrame2GivesThePageAndThisClientDoesNotUse = {
    trace: ignored, TRACK_MP_LOGS: false, ChatNewMsg: (message: unknown) => chat.push(String(message).replace(/<[^>]*>/g, '')),
  };
  Object.assign(context, whatFrame2GivesThePageAndThisClientDoesNotUse);
  run('globalThis.HUD = new Proxy(function () {}, { get: () => globalThis.HUD, apply: () => undefined });');
  for (const guard of ANTI_CHEAT_GUARD_PAIR_NOTHING_TO_GUARD_HERE) context[guard] = ignored;
  const setUpTheDigitsOfEncodedNumbers = `${names.setupClass}.${names.setupMethod}(null, null)`;
  run(setUpTheDigitsOfEncodedNumbers);
  const net = run(names.net);
  const handlerName = reliableMessageHandlerName(gameDir, names.net);
  const errors: string[] = [];
  const handle = net[handlerName];
  const noteAMessageThisPagelessClientCannotActOnInsteadOfStoppingEveryLaterOne = (...args: unknown[]) => {
    try { return handle.apply(net, args); } catch (error) { errors.push((error as Error).message); return undefined; }
  };
  net[handlerName] = noteAMessageThisPagelessClientCannotActOnInsteadOfStoppingEveryLaterOne;
  const conn = new (run(names.connClass))({ url });
  net.connections.push(conn);
  net[names.lobbyConn] = conn;
  const timer = setInterval(() => { try { net[names.netTick](Date.now()); } catch { return; } }, TICK_MS);
  const ContextArray = run('Array');
  const ask = (parts: unknown[]) => new Promise<any[]>((resolve) => {
    const out = ContextArray.from(parts.map((part) => (part === 'REPLY' ? net[names.netReplyTo] : part)));
    out[0] = net[parts[0] as string];
    conn[names.netSend](net[names.netChannel], out, (reply: ArrayLike<unknown>) => { resolve(Array.from(reply)); });
  });
  return {
    net, conn, chat, errors, run,
    ask,
    login: (login, password) => ask(['RELIABLE_AUTHENTICATE', login, password, 'version_h5', 'hash_h5', 'REPLY', 'test', '"test.device"', '1769098189070']),
    list: () => ask(['RELIABLE_GET_MATCH_LIST', '{}', 'REPLY', 'match_list']),
    create: (settings) => ask(['RELIABLE_CREATE_MATCH', JSON.stringify(settings), 'REPLY']),
    join: (uid, password = '') => ask(['RELIABLE_JOIN_MATCH', uid, 'REPLY', -1, '1', password]),
    say: (text) => { net.Event(net.RELIABLE_CHAT, net[names.netNum](CHAT_TO_EVERYONE_NOT_TEAM), text); },
    closed: () => !!conn[names.connClosed],
    close() { clearInterval(timer); try { conn.Disconnect(); } catch { return; } },
  };
}

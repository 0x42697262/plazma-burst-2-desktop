import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { decodeNumber, parsePacket, splitParts } from '#console/kernel/net/codec.ts';
import { stringOf } from '#kernel/text/text-of.ts';
import { TICK_MS } from '../constants.ts';
import {
  CONTEXT_ARRAY, GAME_SCRIPTS, PAGE_HOST, PAGE_HREF, PAGE_PROTOCOL, REPLY_PLACEHOLDER, SILENT_HUD, TEXT_ENCODING, USER_AGENT, setupCall, type NeededName,
} from '../keys.ts';

type Bag = Record<string, unknown>;
type Callable = (...args: unknown[]) => unknown;
type Constructor = new (options: Bag) => Bag;
type ArrayMaker = { from(items: readonly unknown[]): unknown[] };

export type LobbyNames = Readonly<Record<NeededName, string>>;
export type ReliableMessage = Readonly<{ type: string; parts: readonly string[]; digits: string }>;
export type LobbyClient = {
  ask(parts: readonly unknown[]): Promise<unknown[]>;
  onMessage(listener: (message: ReliableMessage) => void): void;
  isRegisteredAsMainServer(): boolean;
  close(): void;
};

const ignored = (): undefined => undefined;

function gameContext(gameDir: string, names: LobbyNames): Bag {
  const context: Bag = {
    console: { log: ignored, warn: ignored, error: ignored, info: ignored, debug: ignored },
    setTimeout, clearTimeout, setInterval, clearInterval, performance, URL, URLSearchParams, TextEncoder, TextDecoder, WebSocket,
    location: { hash: '', href: PAGE_HREF, protocol: PAGE_PROTOCOL, hostname: PAGE_HOST },
    navigator: { userAgent: USER_AGENT },
  };
  context.globalThis = context;
  context.window = context;
  context.self = context;
  vm.createContext(context);
  for (const script of GAME_SCRIPTS) vm.runInContext(fs.readFileSync(path.join(gameDir, script), TEXT_ENCODING), context, { filename: script });
  const pageFunctionsTheseScriptsCall = { trace: ignored, TRACK_MP_LOGS: false, ChatNewMsg: ignored, ReportCaughtError: ignored, [names.tickGuardBefore]: ignored, [names.tickGuardAfter]: ignored };
  Object.assign(context, pageFunctionsTheseScriptsCall);
  vm.runInContext(SILENT_HUD, context);
  vm.runInContext(setupCall(names.setupClass, names.setupMethod), context);
  return context;
}

export function connectLobby({ gameDir, names, url }: { gameDir: string; names: LobbyNames; url: string }): LobbyClient {
  const context = gameContext(gameDir, names);
  const run = (code: string): unknown => vm.runInContext(code, context);
  const net = run(names.net) as Bag & { connections: Bag[] };
  const ConnectionClass = run(names.connClass) as Constructor;
  const connection = new ConnectionClass({ url });
  net.connections.push(connection);
  const listeners: ((message: ReliableMessage) => void)[] = [];
  const received = (connection[names.connRecv] as Callable).bind(connection);
  connection[names.connRecv] = (text: string) => {
    const digits = stringOf(net[names.netDigits] ?? '');
    const typeNames = net[names.netTypeNames] as Readonly<Record<number, string>>;
    for (const entry of parsePacket(text).rel) {
      const parts = splitParts(entry.data);
      const type = decodeNumber(parts[0], digits);
      const message: ReliableMessage = Object.freeze({ type: type === null ? '' : typeNames[type] ?? '', parts, digits });
      for (const listener of listeners) listener(message);
    }
    return received(text);
  };
  const tick = net[names.netTick] as Callable;
  const timer = setInterval(() => {
    try {
      tick.call(net, Date.now());
    } catch {
      return;
    }
  }, TICK_MS);
  const ContextArray = run(CONTEXT_ARRAY) as ArrayMaker;
  const send = connection[names.netSend] as Callable;
  return {
    ask: (parts) => new Promise((resolve) => {
      const out = ContextArray.from(parts.map((part) => (part === REPLY_PLACEHOLDER ? net[names.netReplyTo] : part)));
      out[0] = net[String(parts[0])];
      send.call(connection, net[names.netChannel], out, (reply: ArrayLike<unknown>) => { resolve(Array.from(reply)); });
    }),
    onMessage(listener) {
      listeners.push(listener);
    },
    isRegisteredAsMainServer: () => net[names.lobbyConn] === connection,
    close() {
      clearInterval(timer);
      try {
        (connection.Disconnect as Callable).call(connection);
      } catch {
        return;
      }
    },
  };
}

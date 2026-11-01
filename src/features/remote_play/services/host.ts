import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { WebSocketServer, WebSocket, type RawData } from 'ws';
import { HTTP_METHOD, STATUS } from '#shared/contract/keys.ts';
import {
  CLOSE, CLOSE_REASON_LENGTH, HELLO_TIMEOUT_MS, HOST_DEFAULTS, MAX_BUFFERED_BYTES, MAX_INPUT_PER_SECOND, MAX_PAYLOAD_BYTES,
  MILLISECONDS_PER_SECOND, PING_MS, WRONG_LINKS_MAX, WRONG_LINKS_WINDOW_MS,
} from '../constants.ts';
import { CLIENT_FILES, CONTENT_TYPE_HEADER, MESSAGE, RESPONSE_HEADERS, SOCKET_EVENT, URL_BASE, WS_PATH } from '../keys.ts';
import { LOG, TEXT } from '../text.ts';
import { toInputEvents, releaseAll, type InputEvent, type StreamSize } from '../domain/input.ts';
import { clientAddress } from '../domain/client-address.ts';
import { createWrongLinks } from '../domain/wrong-links.ts';
import type { Tester } from '../adapters/testers-file.ts';

export type FrameEncoder = () => Buffer;
export type RemoteGame = {
  size: StreamSize;
  onFrame(listener: (encode: FrameEncoder) => void): () => void;
  sendInput(event: InputEvent): void;
  focus(): void;
  refresh(): void;
  destroy(): void;
  onGone(listener: () => void): void;
};
export type HostLog = { info(message: string): void; warn(message: string): void; error(message: string): void; debug?(message: string): void };
export type HostOptions = {
  port?: number;
  bind?: string;
  maxGames?: number;
  fps?: number;
  idleMs?: number;
  clientDir: string;
  findTester: (token: unknown) => Tester | null;
  createGame: (tester: Tester) => Promise<RemoteGame>;
  log: HostLog;
};
export type Host = {
  ready: Promise<number>;
  sessions(): { name: string; connected: boolean }[];
  close(): Promise<void>;
};

type Entry = {
  name: string;
  game: RemoteGame | null;
  socket: WebSocket | null;
  idleTimer: NodeJS.Timeout | undefined;
  pressed: Set<string>;
  unsubscribe: (() => void) | null;
  closed: boolean;
  starting: Promise<void> | null;
};
type AliveSocket = WebSocket & { isAlive?: boolean };
type Message = Record<string, unknown>;

const bufferOf = (data: RawData): Buffer => {
  if (Buffer.isBuffer(data)) return data;
  return Array.isArray(data) ? Buffer.concat(data) : Buffer.from(data);
};

const parseMessage = (data: RawData): Message | null => {
  try {
    const parsed: unknown = JSON.parse(bufferOf(data).toString());
    return parsed && typeof parsed === 'object' ? parsed as Message : null;
  } catch {
    return null;
  }
};

function destroyQuietly(game: RemoteGame | null): void {
  try {
    game?.destroy();
  } catch {
    return;
  }
}

const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

export function startHost(options: HostOptions): Host {
  const port = options.port ?? HOST_DEFAULTS.port;
  const bind = options.bind ?? HOST_DEFAULTS.bind;
  const maxGames = options.maxGames ?? HOST_DEFAULTS.maxGames;
  const fps = options.fps ?? HOST_DEFAULTS.fps;
  const idleMs = options.idleMs ?? HOST_DEFAULTS.idleMs;
  const { clientDir, findTester, createGame, log } = options;
  const debug = (message: string): void => { log.debug?.(message); };
  const games = new Map<string, Entry>();
  const minFrameMs = MILLISECONDS_PER_SECOND / fps;
  const wrongLinks = createWrongLinks();

  const server = http.createServer((request, response) => {
    const url = new URL(request.url ?? '', URL_BASE);
    const clientFile = request.method === HTTP_METHOD.get ? CLIENT_FILES[url.pathname] : undefined;
    if (!clientFile) {
      response.writeHead(STATUS.notFound, RESPONSE_HEADERS);
      response.end(TEXT.notFound);
      return;
    }
    fs.readFile(path.join(clientDir, clientFile.file), (error, data) => {
      if (error) {
        response.writeHead(STATUS.serverError, RESPONSE_HEADERS);
        response.end();
        return;
      }
      response.writeHead(STATUS.ok, { ...RESPONSE_HEADERS, [CONTENT_TYPE_HEADER]: clientFile.type });
      response.end(data);
    });
  });

  const sockets = new WebSocketServer({ server, path: WS_PATH, maxPayload: MAX_PAYLOAD_BYTES });

  const sendJson = (socket: WebSocket, message: Message): void => {
    if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
  };
  const refuse = (socket: WebSocket, code: number, message: string): void => {
    sendJson(socket, { t: MESSAGE.error, message });
    socket.close(code, message.slice(0, CLOSE_REASON_LENGTH));
  };

  function closeGame(entry: Entry, why: string): void {
    entry.closed = true;
    clearTimeout(entry.idleTimer);
    games.delete(entry.name);
    destroyQuietly(entry.game);
    log.info(LOG.gameClosed(entry.name, why));
  }

  function detach(entry: Entry, socket: WebSocket | null): void {
    if (entry.socket !== socket) return;
    entry.unsubscribe?.();
    entry.unsubscribe = null;
    for (const event of releaseAll(entry.pressed)) entry.game?.sendInput(event);
    entry.pressed.clear();
    entry.socket = null;
    if (entry.closed) return;
    const idleSeconds = Math.round(idleMs / MILLISECONDS_PER_SECOND);
    entry.idleTimer = setTimeout(() => { closeGame(entry, LOG.idleClose(idleSeconds)); }, idleMs);
  }

  function attach(entry: Entry, game: RemoteGame, socket: WebSocket): void {
    clearTimeout(entry.idleTimer);
    entry.socket = socket;
    let lastFrameAt = 0;
    entry.unsubscribe = game.onFrame((encode) => {
      const isBackedUp = socket.readyState !== WebSocket.OPEN || socket.bufferedAmount > MAX_BUFFERED_BYTES;
      if (isBackedUp) return;
      const now = Date.now();
      if (now - lastFrameAt < minFrameMs) return;
      lastFrameAt = now;
      socket.send(encode(), { binary: true });
    });
    sendJson(socket, { t: MESSAGE.ready, name: entry.name, ...game.size });
    game.focus();
    game.refresh();

    let windowStart = Date.now();
    let inputCount = 0;
    socket.on(SOCKET_EVENT.message, (data: RawData, isBinary: boolean) => {
      if (isBinary || entry.socket !== socket) return;
      const now = Date.now();
      if (now - windowStart >= MILLISECONDS_PER_SECOND) {
        windowStart = now;
        inputCount = 0;
      }
      if (++inputCount > MAX_INPUT_PER_SECOND) return;
      const message = parseMessage(data);
      if (!message) return;
      const events = toInputEvents(message, game.size);
      const code = typeof message.code === 'string' ? message.code : '';
      if (events.length && message.t === MESSAGE.keyDown) entry.pressed.add(code);
      if (message.t === MESSAGE.keyUp) entry.pressed.delete(code);
      for (const event of events) game.sendInput(event);
    });
    socket.on(SOCKET_EVENT.close, () => { detach(entry, socket); });
  }

  function noteWrongLink(address: string): void {
    const note = wrongLinks.note(address);
    if (note === 'first') log.warn(LOG.wrongLink(address));
    if (note === 'limit') log.warn(LOG.wrongLinkLimit(address, WRONG_LINKS_MAX, WRONG_LINKS_WINDOW_MS / MILLISECONDS_PER_SECOND));
  }

  function startGame(tester: Tester): Entry {
    const entry: Entry = { name: tester.name, game: null, socket: null, idleTimer: undefined, pressed: new Set(), unsubscribe: null, closed: false, starting: null };
    games.set(tester.name, entry);
    entry.starting = (async () => {
      let game: RemoteGame;
      try {
        game = await createGame(tester);
      } catch (error) {
        games.delete(tester.name);
        log.error(LOG.notStarted(tester.name, errorMessage(error)));
        throw error;
      }
      entry.game = game;
      game.onGone(() => {
        if (entry.socket) refuse(entry.socket, CLOSE.gone, TEXT.gameStopped);
        closeGame(entry, LOG.processEnded);
      });
      log.info(LOG.started(tester.name, games.size, maxGames));
      if (!entry.socket) detach(entry, null);
    })();
    return entry;
  }

  async function welcome(socket: WebSocket, token: unknown, address: string): Promise<void> {
    if (wrongLinks.isLimited(address)) {
      refuse(socket, CLOSE.badToken, TEXT.tooManyWrongLinks);
      return;
    }
    const tester = findTester(token);
    if (!tester) {
      noteWrongLink(address);
      refuse(socket, CLOSE.badToken, TEXT.invalidLink);
      return;
    }
    let entry = games.get(tester.name);
    if (!entry) {
      if (games.size >= maxGames) {
        refuse(socket, CLOSE.full, TEXT.full(maxGames));
        log.warn(LOG.refusedFull(tester.name, maxGames));
        return;
      }
      entry = startGame(tester);
    }
    if (!entry.game) {
      try {
        await entry.starting;
      } catch {
        refuse(socket, CLOSE.gone, TEXT.gameNotStarted);
        return;
      }
    }
    const game = entry.game;
    if (socket.readyState !== WebSocket.OPEN || entry.closed || !game) return;
    const previous = entry.socket;
    if (previous && previous !== socket) {
      sendJson(previous, { t: MESSAGE.error, message: TEXT.openedElsewhere });
      previous.close(CLOSE.replaced, TEXT.openedElsewhereReason);
      detach(entry, previous);
    }
    log.info(LOG.connected(tester.name));
    attach(entry, game, socket);
    socket.on(SOCKET_EVENT.close, () => { log.info(LOG.disconnected(tester.name)); });
  }

  sockets.on(SOCKET_EVENT.error, (error: Error) => { log.warn(LOG.serverError(error.message)); });

  sockets.on(SOCKET_EVENT.connection, (socket: AliveSocket, request: http.IncomingMessage) => {
    const address = clientAddress(request.socket.remoteAddress, request.headers);
    socket.on(SOCKET_EVENT.error, (error: Error) => {
      debug(LOG.dropped(error.message));
      socket.terminate();
    });
    socket.isAlive = true;
    socket.on(SOCKET_EVENT.pong, () => { socket.isAlive = true; });
    const helloTimer = setTimeout(() => { refuse(socket, CLOSE.protocol, TEXT.noHello); }, HELLO_TIMEOUT_MS);
    socket.once(SOCKET_EVENT.close, () => { clearTimeout(helloTimer); });
    socket.once(SOCKET_EVENT.message, (data: RawData, isBinary: boolean) => {
      clearTimeout(helloTimer);
      const message = isBinary ? null : parseMessage(data);
      if (message?.t !== MESSAGE.hello) {
        refuse(socket, CLOSE.protocol, TEXT.expectedHello);
        return;
      }
      welcome(socket, message.token, address).catch((error: unknown) => {
        log.error(LOG.welcomeFailed(error instanceof Error ? error.stack ?? error.message : String(error)));
        refuse(socket, CLOSE.gone, TEXT.hostError);
      });
    });
  });

  const pinger = setInterval(() => {
    for (const client of sockets.clients as Set<AliveSocket>) {
      if (!client.isAlive) {
        client.terminate();
        continue;
      }
      client.isAlive = false;
      client.ping();
    }
  }, PING_MS);

  const ready = new Promise<number>((resolve, reject) => {
    server.once(SOCKET_EVENT.error, reject);
    server.listen(port, bind, () => { resolve((server.address() as AddressInfo).port); });
  });

  return {
    ready,
    sessions: () => [...games.values()].map((entry) => ({ name: entry.name, connected: !!entry.socket })),
    async close() {
      clearInterval(pinger);
      for (const client of sockets.clients) client.terminate();
      for (const entry of [...games.values()]) closeGame(entry, LOG.hostStopped);
      await new Promise<void>((resolve) => {
        sockets.close(() => {
          server.close(() => { resolve(); });
          server.closeAllConnections();
        });
      });
    },
  };
}

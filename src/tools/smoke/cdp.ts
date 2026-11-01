import { WebSocket } from 'ws';
import { SOCKET_MESSAGE_EVENT } from './constants.ts';
import { TEXT } from './text.ts';

type Pending = { resolve: (value: unknown) => void; reject: (error: Error) => void };
type EventHandler = (params: Record<string, unknown>) => void;
type CdpMessage = { id?: number; method?: string; params?: Record<string, unknown>; result?: unknown; error?: { message: string } };

export type CdpSession = {
  send(method: string, params?: Record<string, unknown>): Promise<unknown>;
  on(method: string, handler: EventHandler): void;
  close(): void;
};

export function connectCdp(webSocketUrl: string): Promise<CdpSession> {
  const socket = new WebSocket(webSocketUrl);
  const pending = new Map<number, Pending>();
  const handlers = new Map<string, EventHandler[]>();
  let nextId = 1;
  socket.on(SOCKET_MESSAGE_EVENT, (raw: Buffer) => {
    const message = JSON.parse(raw.toString()) as CdpMessage;
    if (message.id !== undefined) {
      const waiting = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) waiting?.reject(new Error(TEXT.cdpError(message.error.message)));
      else waiting?.resolve(message.result);
      return;
    }
    if (message.method) for (const handler of handlers.get(message.method) ?? []) handler(message.params ?? {});
  });
  const session: CdpSession = {
    send(method, params = {}) {
      const id = nextId++;
      socket.send(JSON.stringify({ id, method, params }));
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    },
    on(method, handler) {
      handlers.set(method, [...(handlers.get(method) ?? []), handler]);
    },
    close() {
      socket.close();
    },
  };
  return new Promise((resolve, reject) => {
    socket.once('open', () => resolve(session));
    socket.once('error', reject);
  });
}

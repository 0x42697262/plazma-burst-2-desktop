import net from 'node:net';
import tls from 'node:tls';
import { NANOSECONDS_PER_MILLISECOND, PROBE_TIMEOUT_MS, STATUS_BYTES_MAX } from '../constants.ts';
import { SOCKET_EVENT, statusRequest } from '../keys.ts';
import { PROBE_TEXT } from '../text.ts';
import { parseStatusResponse, type ServerStatus } from '../domain/status.ts';
import type { ServerEntry } from '../domain/server.ts';

export class NotPinnedError extends Error {
  readonly pinned = false;
}

export type ServerProbe = {
  ping(host: string, port: number): Promise<number | null>;
  fingerprint(host: string, port: number): Promise<string>;
  status(server: Pick<ServerEntry, 'host' | 'port' | 'hostPort' | 'fingerprint'>): Promise<ServerStatus>;
};

const serverNameFor = (host: string): string | undefined => (net.isIP(host) ? undefined : host);

export function createProbe(timeout: number = PROBE_TIMEOUT_MS): ServerProbe {
  return {
    ping: (host, port) => new Promise((resolve) => {
      const started = process.hrtime.bigint();
      const socket = net.connect({ host, port });
      const done = (milliseconds: number | null): void => { socket.destroy(); resolve(milliseconds); };
      socket.setTimeout(timeout, () => done(null));
      socket.once(SOCKET_EVENT.error, () => done(null));
      socket.once(SOCKET_EVENT.connect, () => done(Number(process.hrtime.bigint() - started) / NANOSECONDS_PER_MILLISECOND));
    }),

    fingerprint: (host, port) => new Promise((resolve, reject) => {
      const socket = tls.connect({ host, port, rejectUnauthorized: false, servername: serverNameFor(host) });
      socket.setTimeout(timeout, () => { socket.destroy(); reject(new Error(PROBE_TEXT.noAnswer)); });
      socket.once(SOCKET_EVENT.error, reject);
      socket.once(SOCKET_EVENT.secureConnect, () => {
        const certificate = socket.getPeerCertificate();
        socket.destroy();
        if (!certificate?.fingerprint256) reject(new Error(PROBE_TEXT.noCertificate));
        else resolve(certificate.fingerprint256);
      });
    }),

    status: (server) => new Promise((resolve, reject) => {
      const socket = tls.connect({ host: server.host, port: server.port, rejectUnauthorized: false, servername: serverNameFor(server.host) });
      let body = '';
      const fail = (error: Error): void => { socket.destroy(); reject(error); };
      socket.setTimeout(timeout, () => fail(new Error(PROBE_TEXT.noAnswer)));
      socket.once(SOCKET_EVENT.error, fail);
      socket.once(SOCKET_EVENT.secureConnect, () => {
        const certificate = socket.getPeerCertificate();
        if (certificate?.fingerprint256 !== server.fingerprint) {
          fail(new NotPinnedError(PROBE_TEXT.notPinned));
          return;
        }
        socket.write(statusRequest(server.hostPort));
      });
      socket.on(SOCKET_EVENT.data, (chunk: Buffer) => {
        body += chunk.toString();
        if (body.length > STATUS_BYTES_MAX) fail(new Error(PROBE_TEXT.tooLong));
      });
      socket.once(SOCKET_EVENT.end, () => {
        try {
          resolve(parseStatusResponse(body));
        } catch (error) {
          reject(error instanceof Error ? error : new Error(String(error)));
        }
      });
    }),
  };
}

import { X509Certificate } from 'node:crypto';
import type { Logger } from '#kernel/log/logger.ts';
import { VERIFY } from './constants.ts';
import { TEXT } from './text.ts';

export type PinnedTarget = { id: string; host: string; hostPort: string; fingerprint: string };
export type VerifyRequest = { hostname: string; certificate: { data: string } };
export type VerifiableSession = { setCertificateVerifyProc(proc: (request: VerifyRequest, callback: (result: number) => void) => void): void };

function fingerprintOf(certificate: { data: string }): string {
  try {
    return new X509Certificate(certificate.data).fingerprint256;
  } catch {
    return '';
  }
}

export function pinCertificates(session: VerifiableSession, target: () => PinnedTarget | null, log: Logger): void {
  let warnedFor: string | null = null;
  session.setCertificateVerifyProc((request, callback) => {
    const pinned = target();
    if (!pinned || request.hostname !== pinned.host) {
      callback(VERIFY.usual);
      return;
    }
    const fingerprint = fingerprintOf(request.certificate);
    if (fingerprint === pinned.fingerprint) {
      callback(VERIFY.trusted);
      return;
    }
    if (warnedFor !== pinned.id) {
      warnedFor = pinned.id;
      log.error(TEXT.notPinned(pinned.hostPort, fingerprint));
    }
    callback(VERIFY.rejected);
  });
}

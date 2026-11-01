import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Logger } from '#kernel/log/logger.ts';
import { VERIFY } from './constants.ts';
import { pinCertificates, type PinnedTarget, type VerifyRequest } from './wrapper.ts';

const TARGET: PinnedTarget = { id: 'one', host: '10.0.0.5', hostPort: '10.0.0.5:8443', fingerprint: 'AA:BB' };

function pinned(target: PinnedTarget | null) {
  const errors: string[] = [];
  let verify: ((request: VerifyRequest, callback: (result: number) => void) => void) | null = null;
  pinCertificates({ setCertificateVerifyProc: (proc) => { verify = proc; } }, () => target, { error: (line: string) => { errors.push(line); } } as unknown as Logger);
  const check = (hostname: string): number => {
    let answer = Number.NaN;
    verify?.({ hostname, certificate: { data: 'not a certificate' } }, (result) => { answer = result; });
    return answer;
  };
  return { check, errors };
}

test('other sites, and every site with no private server chosen, are checked as usual', () => {
  assert.equal(pinned(TARGET).check('www.plazmaburst2.com'), VERIFY.usual);
  assert.equal(pinned(null).check('10.0.0.5'), VERIFY.usual);
});

test('a private server whose certificate is not the saved one is refused, with one error per server', () => {
  const { check, errors } = pinned(TARGET);
  assert.equal(check('10.0.0.5'), VERIFY.rejected);
  assert.equal(check('10.0.0.5'), VERIFY.rejected);
  assert.equal(errors.length, 1);
  assert.match(errors[0] ?? '', /not the saved one \(got none\)/);
});

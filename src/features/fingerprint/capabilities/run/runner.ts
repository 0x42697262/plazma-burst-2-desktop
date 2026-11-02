import { ASYNC_TIMEOUT_MS, MILLISECONDS_PER_SECOND } from '../../constants.ts';
import { KIND, backtickTag, wrapInParentheses, type FingerprintKind } from '../../keys.ts';
import { RUN_TEXT } from './text.ts';

export type RunnableFingerprint = { code: string; kind: FingerprintKind; file: string };
type Fingerprinter = (tag: string, answer?: (value: unknown) => void) => unknown;

const indirectEval = (source: string): unknown => (0, eval)(source);

export function runFingerprinter(fingerprint: RunnableFingerprint, tag: unknown): Promise<unknown> {
  const compiled = indirectEval(wrapInParentheses(fingerprint.code));
  if (typeof compiled !== 'function') return Promise.reject(new Error(RUN_TEXT.notAFunction(fingerprint.file)));
  const fingerprinter = compiled as Fingerprinter;
  const tagText = backtickTag(tag);
  if (fingerprint.kind !== KIND.async) return Promise.resolve(fingerprinter(tagText));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(RUN_TEXT.asyncTimeout(ASYNC_TIMEOUT_MS / MILLISECONDS_PER_SECOND))), ASYNC_TIMEOUT_MS);
    fingerprinter(tagText, (value) => {
      clearTimeout(timer);
      resolve(value);
    });
  });
}

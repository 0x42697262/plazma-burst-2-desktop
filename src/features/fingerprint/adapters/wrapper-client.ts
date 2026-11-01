import { ROUTE, withQuery } from '#shared/contract/routes.ts';
import { HTTP_METHOD, NO_STORE_CACHE, STATUS } from '#shared/contract/keys.ts';
import { KIND_QUERY, type FingerprintKind, type SaveStatus } from '../keys.ts';
import type { Latest, Listed } from './store.ts';

export type SavedAnswer = { id: string; file: string; status: SaveStatus };

async function jsonOrThrow<Value>(response: Response): Promise<Value> {
  if (!response.ok) throw new Error(await response.text());
  return await response.json() as Value;
}

export async function postFingerprint(code: string, kind: FingerprintKind): Promise<SavedAnswer> {
  return jsonOrThrow<SavedAnswer>(await fetch(withQuery(ROUTE.fingerprint, { [KIND_QUERY]: kind }), { method: HTTP_METHOD.post, body: code }));
}

export async function latestFingerprint(): Promise<Latest | null> {
  const response = await fetch(ROUTE.fingerprint, { cache: NO_STORE_CACHE });
  if (response.status === STATUS.notFound) return null;
  return jsonOrThrow<Latest>(response);
}

export async function listFingerprints(): Promise<Listed[]> {
  return jsonOrThrow<Listed[]>(await fetch(ROUTE.fingerprints, { cache: NO_STORE_CACHE }));
}

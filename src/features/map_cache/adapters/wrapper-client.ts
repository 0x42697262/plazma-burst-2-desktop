import { ROUTE, withQuery } from '#shared/contract/routes.ts';
import { HTTP_METHOD, NO_STORE_CACHE } from '#shared/contract/keys.ts';
import { QUERY } from '../keys.ts';

export async function saveMapText(id: string, text: string): Promise<{ ok: boolean; answer: string }> {
  const response = await fetch(withQuery(ROUTE.saveMap, { [QUERY.id]: id }), { method: HTTP_METHOD.post, body: text });
  return { ok: response.ok, answer: await response.text() };
}

export async function savedMapText(id: string): Promise<string | null> {
  const response = await fetch(withQuery(ROUTE.mapFile, { [QUERY.id]: id }), { cache: NO_STORE_CACHE });
  return response.ok ? response.text() : null;
}

export async function localMapIds(): Promise<string[]> {
  return await (await fetch(ROUTE.maps, { cache: NO_STORE_CACHE })).json() as string[];
}

import { CACHE_HEADER, CONTENT_TYPE_HEADER, NO_STORE } from './keys.ts';

export const textResponse = (body: string, status: number): Response => new Response(body, { status });
export type ResponseBody = ConstructorParameters<typeof Response>[0];

export const typedResponse = (body: ResponseBody, type: string, cached = true): Response => new Response(body, {
  headers: cached ? { [CONTENT_TYPE_HEADER]: type } : { [CONTENT_TYPE_HEADER]: type, [CACHE_HEADER]: NO_STORE },
});

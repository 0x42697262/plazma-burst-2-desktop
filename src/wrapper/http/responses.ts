import { CONTENT_TYPE, HEADER, NO_STORE, NOT_FOUND_TEXT, STATUS } from './keys.ts';

export const jsonResponse = (value: unknown, status: number = STATUS.ok): Response => new Response(JSON.stringify(value), {
  status, headers: { [HEADER.contentType]: CONTENT_TYPE.json, [HEADER.cacheControl]: NO_STORE },
});

export const textResponse = (text: string, status: number = STATUS.ok): Response => new Response(text, {
  status, headers: { [HEADER.contentType]: CONTENT_TYPE.text, [HEADER.cacheControl]: NO_STORE },
});

export const errorResponse = (text: string, status: number): Response => new Response(text, { status });

export const notFound = (): Response => errorResponse(NOT_FOUND_TEXT, STATUS.notFound);

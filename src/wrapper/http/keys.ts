export const CONTENT_TYPE = Object.freeze({
  json: 'application/json',
  text: 'text/plain; charset=utf-8',
});
export const HEADER = Object.freeze({ contentType: 'Content-Type', cacheControl: 'Cache-Control' });
export { NO_STORE_CACHE as NO_STORE } from '#shared/contract/keys.ts';
export { HTTP_METHOD, STATUS } from '#shared/contract/keys.ts';
export const NOT_FOUND_TEXT = 'Not found';

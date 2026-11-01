export const CONTENT_TYPE = Object.freeze({
  json: 'application/json',
  text: 'text/plain; charset=utf-8',
});
export const HEADER = Object.freeze({ contentType: 'Content-Type', cacheControl: 'Cache-Control' });
export const NO_STORE = 'no-store';
export const HTTP_METHOD = Object.freeze({ get: 'GET', post: 'POST', put: 'PUT' });
export const STATUS = Object.freeze({ ok: 200, badRequest: 400, forbidden: 403, notFound: 404, methodNotAllowed: 405, conflict: 409, tooMany: 429, serverError: 500 });
export const NOT_FOUND_TEXT = 'Not found';

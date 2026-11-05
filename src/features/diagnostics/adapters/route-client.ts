import { ROUTE, withQuery } from '#shared/contract/routes.ts';
import { HTTP_METHOD, NO_STORE_CACHE } from '#shared/contract/keys.ts';
import { REPORT_QUERY } from '../keys.ts';

async function jsonOrThrow<Answer>(response: Response): Promise<Answer> {
  if (!response.ok) throw new Error(await response.text());
  return await response.json() as Answer;
}

export const readDiagnostics = <Answer>(): Promise<Answer> => fetch(ROUTE.diagnostics, { cache: NO_STORE_CACHE }).then(jsonOrThrow<Answer>);
export const readReport = <Answer>(word: string): Promise<Answer> => fetch(withQuery(ROUTE.diagnostics, { [REPORT_QUERY]: word }), { cache: NO_STORE_CACHE }).then(jsonOrThrow<Answer>);
export const postDiagnostics = <Answer>(body: Record<string, unknown>): Promise<Answer> => fetch(ROUTE.diagnostics, { method: HTTP_METHOD.post, body: JSON.stringify(body) }).then(jsonOrThrow<Answer>);

import { ROUTE } from '#shared/contract/routes.ts';
import { HTTP_METHOD, NO_STORE_CACHE, STATUS } from '#shared/contract/keys.ts';
import { COMMAND_TEXT } from '../text.ts';
import type { Operation } from '../keys.ts';

type RouteAnswer = { ok: boolean; value?: unknown; error?: string };

export async function askServerList<Value>(operation: Operation, argument?: unknown): Promise<Value> {
  let response: Response;
  try {
    response = await fetch(ROUTE.servers, { method: HTTP_METHOD.post, body: JSON.stringify({ op: operation, arg: argument }), cache: NO_STORE_CACHE });
  } catch {
    throw new Error(COMMAND_TEXT.wrapperOnly);
  }
  if (response.status === STATUS.forbidden) throw new Error(COMMAND_TEXT.notInThisWindow);
  const answer = await response.json() as RouteAnswer;
  if (!answer.ok) throw new Error(answer.error);
  return answer.value as Value;
}

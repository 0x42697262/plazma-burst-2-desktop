import { HTTP_METHOD } from '#shared/contract/keys.ts';
import { SEND_TIMEOUT_MS } from '../constants.ts';
import { CONTENT_TYPE } from '../keys.ts';
import { CONFIG_TEXT as TEXT } from '../text.ts';

export type Fetcher = (url: string, init: RequestInit) => Promise<Response>;

export async function deliverReports(fetcher: Fetcher, host: string, body: string): Promise<void> {
  const response = await fetcher(host, { method: HTTP_METHOD.post, headers: CONTENT_TYPE, body, signal: AbortSignal.timeout(SEND_TIMEOUT_MS) });
  if (!response.ok) throw new Error(TEXT.httpStatus(response.status));
}

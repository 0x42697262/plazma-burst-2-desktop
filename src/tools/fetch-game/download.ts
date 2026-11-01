import { CLIENT_ERRORS, OK, REDIRECTS, RETRY_BASE_MS, RETRY_GROWTH, TRIES } from './constants.ts';
import { CONTENT_TYPE, HTML_CONTENT, HTML_PATH, REDIRECT_MANUAL, USER_AGENT, USER_AGENT_HEADER } from './keys.ts';
import { TEXT } from './text.ts';

const sleep = (milliseconds: number): Promise<void> => new Promise((resolve) => { setTimeout(resolve, milliseconds); });

async function withRetries(url: string, attemptOnce: () => Promise<Buffer | null>, tries: number): Promise<Buffer | null> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await attemptOnce();
    } catch (error) {
      if (attempt >= tries) throw new Error(TEXT.failedUrl(url, (error as Error).message), { cause: error });
      await sleep(RETRY_BASE_MS * RETRY_GROWTH ** attempt);
    }
  }
}

export function getSitePage(url: string, tries = TRIES): Promise<Buffer | null> {
  return withRetries(url, async () => {
    const response = await fetch(url, { headers: { [USER_AGENT_HEADER]: USER_AGENT } });
    if (response.status >= CLIENT_ERRORS.min && response.status < CLIENT_ERRORS.max) return null;
    if (response.status !== OK) throw new Error(TEXT.httpStatus(response.status));
    const type = response.headers.get(CONTENT_TYPE) || '';
    const isGamePageInstead = HTML_CONTENT.test(type) && !HTML_PATH.test(new URL(url).pathname);
    if (isGamePageInstead) return null;
    return Buffer.from(await response.arrayBuffer());
  }, tries);
}

export function getListedFile(url: string, tries = TRIES): Promise<Buffer | null> {
  return withRetries(url, async () => {
    const response = await fetch(url, { redirect: REDIRECT_MANUAL, headers: { [USER_AGENT_HEADER]: USER_AGENT } });
    if (response.status === OK) return Buffer.from(await response.arrayBuffer());
    if (response.status >= REDIRECTS.min && response.status < REDIRECTS.max) return null;
    throw new Error(TEXT.httpStatus(response.status));
  }, tries);
}

export async function pool<Item>(items: readonly Item[], jobs: number, work: (item: Item, index: number) => Promise<unknown>): Promise<void> {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(jobs, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      await work(items[index] as Item, index);
    }
  }));
}

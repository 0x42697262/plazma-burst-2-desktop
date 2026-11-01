import { PAGE_LOAD_DESTINATIONS } from '../keys.ts';

export function isGamePage(url: string, startUrl: string): boolean {
  try {
    const page = new URL(url);
    const start = new URL(startUrl);
    return page.origin === start.origin && page.pathname === start.pathname;
  } catch {
    return false;
  }
}

export const isRefusedPageLoad = (destination: string | null, url: string, startUrl: string): boolean =>
  destination !== null && PAGE_LOAD_DESTINATIONS.has(destination) && !isGamePage(url, startUrl);

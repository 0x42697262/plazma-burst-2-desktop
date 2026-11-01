import { DEV_DIR, QUERY_START, ROUTE_NAME, SAVE_RESULT } from './keys.ts';

export type RouteKey = keyof typeof ROUTE_NAME;
export type SaveResult = typeof SAVE_RESULT[keyof typeof SAVE_RESULT];

export const devRoute = (key: RouteKey): string => DEV_DIR + ROUTE_NAME[key];

export const ROUTE: Readonly<Record<RouteKey, string>> = Object.freeze(Object.fromEntries(
  Object.keys(ROUTE_NAME).map((key) => [key, devRoute(key as RouteKey)]),
) as Record<RouteKey, string>);

export const withQuery = (route: string, parameters: Readonly<Record<string, string>>): string => route + QUERY_START + new URLSearchParams(parameters).toString();

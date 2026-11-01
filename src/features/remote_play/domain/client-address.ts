import { FORWARD_HEADER, FORWARD_SEPARATOR, LOOPBACK_ADDRESSES, UNKNOWN_ADDRESS } from '../keys.ts';

export type Headers = Readonly<Record<string, string | string[] | undefined>>;

const firstOf = (value: string | string[] | undefined): string => (Array.isArray(value) ? value[0] ?? '' : value ?? '');

export function clientAddress(remoteAddress: string | undefined, headers: Headers): string {
  const direct = remoteAddress || UNKNOWN_ADDRESS;
  if (!LOOPBACK_ADDRESSES.has(direct)) return direct;
  const forwarded = firstOf(headers[FORWARD_HEADER.cloudflare]) || (firstOf(headers[FORWARD_HEADER.forwardedFor]).split(FORWARD_SEPARATOR)[0] ?? '').trim();
  return forwarded || direct;
}

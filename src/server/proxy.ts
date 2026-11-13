import { FORWARDED_FOR_HEADER, FORWARDED_SEPARATOR } from './keys.ts';

type Headers = Readonly<Record<string, string | string[] | undefined>>;

export function clientAddressOf(headers: Headers, connectionAddress: string): string {
  const forwarded = headers[FORWARDED_FOR_HEADER];
  const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded)?.split(FORWARDED_SEPARATOR)[0]?.trim();
  return first || connectionAddress;
}

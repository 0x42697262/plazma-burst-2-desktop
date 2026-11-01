import { DEFAULT_PORT, PORT_MAX, PORT_MIN } from '../constants.ts';
import { hostPortOf, ADDRESS_PARTS, ADDRESS_SCHEME, BYTE_PAIR_WITH_COLON, BYTE_PAIRS, FINGERPRINT_PREFIX, HOST_PATTERN, IPV6_BRACKETS, NOT_HEX, TRAILING_SLASHES } from '../keys.ts';
import { ENTRY_TEXT } from '../text.ts';

export type Address = { host: string; port: number; hostPort: string };

export function parseAddress(text: unknown): Address {
  const written = typeof text === 'string' ? text : '';
  const cleaned = written.trim().replace(ADDRESS_SCHEME, '').replace(TRAILING_SLASHES, '');
  const match = ADDRESS_PARTS.exec(cleaned);
  const host = match?.[1];
  if (!match || !host || !HOST_PATTERN.test(host)) throw new Error(ENTRY_TEXT.badAddress(written));
  const port = match[2] ? Number(match[2]) : DEFAULT_PORT;
  if (port < PORT_MIN || port > PORT_MAX) throw new Error(ENTRY_TEXT.portRange(port));
  return { host: host.replace(IPV6_BRACKETS, ''), port, hostPort: hostPortOf(host, port) };
}

export const normalFingerprint = (fingerprint: unknown): string => (typeof fingerprint === 'string' ? fingerprint : '')
  .trim().toUpperCase().replace(FINGERPRINT_PREFIX, '').replace(NOT_HEX, '').replace(BYTE_PAIRS, BYTE_PAIR_WITH_COLON);

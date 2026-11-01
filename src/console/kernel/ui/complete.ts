import { SCHEMA } from '../state/schema.ts';
import { commandNames, findRunnable } from '../commands/registry.ts';
import { SPACE, WORDS } from './keys.ts';
import { WORDS_BEFORE_ARGUMENTS } from './constants.ts';

export function complete(value: string): { value?: string; hits?: string[] } {
  const parts = value.split(WORDS);
  const last = (parts[parts.length - 1] ?? '').toLowerCase();
  if (!last) return {};
  const keys = Object.keys(SCHEMA);
  const offered = parts.length === 1 ? null : findRunnable(parts[0])?.complete?.(parts.length - WORDS_BEFORE_ARGUMENTS);
  const pool: readonly string[] = parts.length === 1 ? [...commandNames(), ...keys] : offered ?? keys;
  const hits = pool.filter((word) => word.startsWith(last));
  const [onlyHit] = hits;
  if (hits.length === 1 && onlyHit !== undefined) {
    parts[parts.length - 1] = onlyHit;
    return { value: parts.join(SPACE) + SPACE };
  }
  return hits.length ? { hits } : {};
}

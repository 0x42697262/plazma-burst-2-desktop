// Tab completion: the first word from commands and keys, later words from what the
// command offers for that argument (gun models for "give"), otherwise from keys.
import { SCHEMA } from '../state/schema.js';
import { commandNames, findRunnable } from '../commands/registry.js';

// Returns { value } when one word fits, { hits } when several do, or {} for none.
export function complete(value) {
  const parts = value.split(/\s+/);
  const last = parts[parts.length - 1].toLowerCase();
  if (!last) return {};
  let pool;
  if (parts.length === 1) {
    pool = [...commandNames(), ...Object.keys(SCHEMA)];
  } else {
    const cmd = findRunnable(parts[0]);
    pool = (cmd && cmd.complete && cmd.complete(parts.length - 2)) || Object.keys(SCHEMA);
  }
  const hits = pool.filter((k) => k.startsWith(last));
  if (hits.length === 1) {
    parts[parts.length - 1] = hits[0];
    return { value: parts.join(' ') + ' ' };
  }
  return hits.length ? { hits } : {};
}

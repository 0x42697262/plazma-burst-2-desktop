type Target = Record<string, unknown>;

const forced = new Map<object, Map<string, unknown>>();

export function force(target: object, field: string, value: unknown): void {
  const fields = target as Target;
  let originals = forced.get(target);
  if (!originals) {
    originals = new Map();
    forced.set(target, originals);
  }
  if (!originals.has(field)) originals.set(field, fields[field]);
  if (fields[field] !== value) fields[field] = value;
}

export function original(target: object, field: string): unknown {
  const originals = forced.get(target);
  return originals?.has(field) ? originals.get(field) : (target as Target)[field];
}

export function restore(target: object, field: string): boolean {
  const originals = forced.get(target);
  if (!originals?.has(field)) return false;
  (target as Target)[field] = originals.get(field);
  originals.delete(field);
  if (originals.size === 0) forced.delete(target);
  return true;
}

export function restoreObj(target: object): void {
  const originals = forced.get(target);
  if (!originals) return;
  for (const [field, value] of originals) (target as Target)[field] = value;
  forced.delete(target);
}

export const restoreAll = (): void => {
  for (const target of [...forced.keys()]) restoreObj(target);
};

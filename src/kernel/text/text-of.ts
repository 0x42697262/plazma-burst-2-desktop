export function textOf(value: unknown): string {
  if (typeof value === 'string') return value;
  const isPrimitive = typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint' || value === null || value === undefined;
  if (isPrimitive) return String(value);
  return JSON.stringify(value) ?? '';
}

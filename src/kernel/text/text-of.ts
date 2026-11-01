export function textOf(value: unknown): string {
  if (typeof value === 'string') return value;
  const isPrimitive = typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint' || value === null || value === undefined;
  if (isPrimitive) return String(value);
  return JSON.stringify(value) ?? '';
}

type Printable = { toString(): unknown };

export function stringOf(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value !== null && (typeof value === 'object' || typeof value === 'function')) {
    const printed = (value as Printable).toString();
    return typeof printed === 'string' ? printed : '';
  }
  return String(value);
}

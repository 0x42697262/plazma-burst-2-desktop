// Forcing a value on a game object, remembering the original so it can be put back.
const forced = new Map(); // object -> Map(field -> original value)

export function force(obj, field, value) {
  let m = forced.get(obj);
  if (!m) { m = new Map(); forced.set(obj, m); }
  if (!m.has(field)) m.set(field, obj[field]);
  if (obj[field] !== value) obj[field] = value;
}

export function original(obj, field) {
  const m = forced.get(obj);
  return m && m.has(field) ? m.get(field) : obj[field];
}

// Returns true when there was something to put back.
export function restore(obj, field) {
  const m = forced.get(obj);
  if (!m || !m.has(field)) return false;
  obj[field] = m.get(field);
  m.delete(field);
  if (m.size === 0) forced.delete(obj);
  return true;
}

export function restoreObj(obj) {
  const m = forced.get(obj);
  if (!m) return;
  for (const [field, v] of m) obj[field] = v;
  forced.delete(obj);
}

export const restoreAll = () => { for (const o of [...forced.keys()]) restoreObj(o); };

// Everything the console remembers between sessions: your settings, key binds and typed
// commands. Saved to desktop/dev-overrides.json through the desktop wrapper, with
// localStorage as the fallback (and as the copy when the wrapper is not there).
import { SCHEMA, parseValue } from './schema.js';
import { parseKeyName } from './keys.js';
import { ROUTE } from '../core/shared.js';

const LS_KEY = 'pb2dev_kv';
const SAVE_DELAY_MS = 150; // several changes in a row become one write
export const HISTORY_MAX = 200; // typed commands kept for Up/Down

let values = {};
let bindMap = {};
const lines = []; // typed commands, oldest first
let saveTimer = null;

export const settings = {
  has: (key) => Object.hasOwn(values, key),
  get: (key) => values[key],
  // The value in effect: yours, otherwise the key's default.
  effective: (key) => (Object.hasOwn(values, key) ? values[key] : SCHEMA[key].default),
  set(key, v) { values[key] = v; save(); },
  unset(key) { delete values[key]; save(); },
  clear() { values = {}; save(); },
  snapshot: () => ({ ...values }),
};

export const binds = {
  get: (key) => bindMap[key],
  set(key, command) { bindMap[key] = command; save(); },
  remove(key) { delete bindMap[key]; save(); },
  clear() { const n = Object.keys(bindMap).length; bindMap = {}; save(); return n; },
  keys: () => Object.keys(bindMap).sort(),
  boundTo: (command) => Object.keys(bindMap).filter((k) => bindMap[k].toLowerCase() === command),
};

export const history = {
  lines,
  add(line) {
    if (!line.trim() || lines[lines.length - 1] === line) return;
    lines.push(line);
    if (lines.length > HISTORY_MAX) lines.splice(0, lines.length - HISTORY_MAX);
    save();
  },
};

function sanitizeValues(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if (!SCHEMA[k]) continue;
    try { out[k] = parseValue(k, v); } catch {}
  }
  return out;
}

function sanitizeBinds(obj) {
  const out = {};
  if (!obj || typeof obj !== 'object') return out;
  for (const [k, v] of Object.entries(obj)) {
    try { if (typeof v === 'string' && v.trim()) out[parseKeyName(k)] = v.trim(); } catch {}
  }
  return out;
}

// The file holds the settings plus "binds" and "history". An old "tp_key" setting
// becomes a "tp" bind.
function apply(obj) {
  values = sanitizeValues(obj);
  bindMap = sanitizeBinds(obj && obj.binds);
  const typed = obj && Array.isArray(obj.history) ? obj.history.filter((l) => typeof l === 'string' && l.trim()) : [];
  lines.length = 0;
  lines.push(...typed.slice(-HISTORY_MAX));
  if (obj && typeof obj.tp_key === 'string') {
    try {
      const k = parseKeyName(obj.tp_key === ' ' ? 'space' : obj.tp_key);
      if (!bindMap[k]) bindMap[k] = 'tp';
      save();
    } catch {}
  }
}

// Returns where the settings came from: 'file' or 'localStorage'.
export async function load() {
  try {
    const r = await fetch(ROUTE.kv, { cache: 'no-store' });
    if (r.ok) { apply(await r.json()); return 'file'; }
  } catch {}
  try { apply(JSON.parse(localStorage.getItem(LS_KEY) || '{}')); } catch { values = {}; bindMap = {}; }
  return 'localStorage';
}

export function save() {
  const data = JSON.stringify({
    ...values,
    ...(Object.keys(bindMap).length ? { binds: bindMap } : {}),
    ...(lines.length ? { history: lines } : {}),
  });
  try { localStorage.setItem(LS_KEY, data); } catch {}
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fetch(ROUTE.kv, { method: 'PUT', body: data }).catch(() => {});
  }, SAVE_DELAY_MS);
}

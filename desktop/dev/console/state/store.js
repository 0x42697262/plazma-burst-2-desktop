// Everything the console remembers between sessions: your settings, key binds, typed
// commands, and profiles (settings for some maps). Saved to desktop/dev-overrides.json
// through the desktop wrapper, with localStorage as the fallback (and as the copy when
// the wrapper is not there). The wrapper reloads the console's copy when you edit the file.
//
// A setting's value in effect: the current map's profile, then yours, then the default.
import { isFeatureOn } from '../../../../src/console/flags.ts';
import { SCHEMA, parseValue, affectsGame } from './schema.js';
import { parseKeyName } from './keys.js';
import { ROUTE } from '../core/shared.js';

const LS_KEY = 'pb2dev_kv';
const SAVE_DELAY_MS = 150; // several changes in a row become one write
export const HISTORY_MAX = 200; // typed commands kept for Up/Down

let values = {};
let bindMap = {};
// profile name -> { values: { key: value } (game keys only), binds: { key: command },
// onload: commands run as a level on its maps starts, '' for none }. In the file the
// three are one object: the settings, plus "binds" and "onload".
let profileMap = {};
let mapProfiles = {}; // map ID -> profile name
let problems = []; // what was wrong in the file, from the last load
let mapNow = () => null; // the current map's ID; set by index.js
const lines = []; // typed commands, oldest first
let saveTimer = null;

export const setMapSource = (fn) => { mapNow = fn; };
export const currentMap = () => { try { const id = mapNow(); return id ? String(id) : null; } catch { return null; } };

// The profile the current map uses, when it exists: { name, values, binds, onload } or null.
export function activeProfile() {
  if (!isFeatureOn('profiles')) return null;
  const id = currentMap();
  const name = id && mapProfiles[id];
  return name && profileMap[name] ? { name, ...profileMap[name] } : null;
}

const emptyProfile = () => ({ values: {}, binds: {}, onload: '' });
// As it is written in the file: the settings, then "binds" and "onload" when set.
const profileJson = (p) => ({
  ...p.values,
  ...(Object.keys(p.binds).length ? { binds: p.binds } : {}),
  ...(p.onload ? { onload: p.onload } : {}),
});

const fromProfile = (key) => { const p = activeProfile(); return p && Object.hasOwn(p.values, key) ? p : null; };

export const settings = {
  // In effect now: the map's profile, then yours.
  has: (key) => !!fromProfile(key) || Object.hasOwn(values, key),
  get: (key) => { const p = fromProfile(key); return p ? p.values[key] : values[key]; },
  // In effect, otherwise the key's default.
  effective: (key) => (settings.has(key) ? settings.get(key) : SCHEMA[key].default),
  // Where the value in effect comes from: a profile name, 'yours' or 'default'.
  source: (key) => { const p = fromProfile(key); return p ? p.name : Object.hasOwn(values, key) ? 'yours' : 'default'; },
  // Yours alone, whatever a profile says.
  hasOwn: (key) => Object.hasOwn(values, key),
  own: (key) => values[key],
  set(key, v) { values[key] = v; save(); },
  unset(key) { delete values[key]; save(); },
  clear() { values = {}; save(); },
  snapshot: () => ({ ...values }),
};

export const PROFILE_NAME = /^[a-z0-9][a-z0-9_-]{0,31}$/i;

export const profiles = {
  names: () => Object.keys(profileMap).sort(),
  exists: (name) => Object.hasOwn(profileMap, name),
  // { values, binds, onload }, or undefined.
  get: (name) => profileMap[name],
  create(name) {
    if (!PROFILE_NAME.test(name)) throw new Error(`"${name}" is not a profile name: letters, digits, _ and -, up to 32`);
    if (!profileMap[name]) { profileMap[name] = emptyProfile(); save(); }
  },
  set(name, key, v) { profiles.create(name); profileMap[name].values[key] = v; save(); },
  unset(name, key) { if (profileMap[name]) { delete profileMap[name].values[key]; save(); } },
  bind(name, key, command) { profiles.create(name); profileMap[name].binds[key] = command; save(); },
  unbind(name, key) { if (profileMap[name]) { delete profileMap[name].binds[key]; save(); } },
  setOnload(name, commands) { profiles.create(name); profileMap[name].onload = commands; save(); },
  // Deletes the profile and every map's use of it. Returns those maps.
  remove(name) {
    const maps = profiles.mapsUsing(name);
    delete profileMap[name];
    for (const id of maps) delete mapProfiles[id];
    save();
    return maps;
  },
  of: (mapId) => mapProfiles[mapId] ?? null,
  use(mapId, name) {
    if (name === null) delete mapProfiles[mapId];
    else { profiles.create(name); mapProfiles[mapId] = name; }
    save();
  },
  mapsUsing: (name) => Object.keys(mapProfiles).filter((id) => mapProfiles[id] === name).sort(),
  maps: () => ({ ...mapProfiles }),
};

// What was wrong in dev-overrides.json at the last load, as lines to print.
export const loadProblems = () => problems.slice();

export const binds = {
  get: (key) => bindMap[key],
  // What the key runs now: this map's profile bind, then yours. { command, profile } or null.
  active(key) {
    const p = activeProfile();
    if (p && p.binds[key]) return { command: p.binds[key], profile: p.name };
    return bindMap[key] ? { command: bindMap[key], profile: null } : null;
  },
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

// The file's other top-level entries, which are not settings.
const FILE_SECTIONS = ['binds', 'history', 'profiles', 'maps', 'tp_key'];
// A profile's entries that are not settings.
const PROFILE_SECTIONS = ['binds', 'onload'];

// where: "" for your settings, 'profile "x": ' for a profile.
function sanitizeValues(obj, where, onlyGameKeys) {
  const out = {};
  for (const [k, v] of Object.entries(obj || {})) {
    if ((where ? PROFILE_SECTIONS : FILE_SECTIONS).includes(k)) continue;
    if (!SCHEMA[k]) { problems.push(`${where}unknown key "${k}", ignored`); continue; }
    if (onlyGameKeys && !affectsGame(k)) { problems.push(`${where}${k} is a console key, which a profile cannot set; ignored`); continue; }
    try { out[k] = parseValue(k, v); } catch (e) { problems.push(`${where}${k} ${JSON.stringify(v)}: ${e.message}; ignored`); }
  }
  return out;
}

const isObject = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

function sanitizeProfiles(obj) {
  const out = {};
  if (obj === undefined) return out;
  if (!isObject(obj)) { problems.push('"profiles" must be an object of profile name -> settings; ignored'); return out; }
  for (const [name, vals] of Object.entries(obj)) {
    if (!PROFILE_NAME.test(name)) { problems.push(`profile "${name}": not a profile name (letters, digits, _ and -); ignored`); continue; }
    if (!isObject(vals)) { problems.push(`profile "${name}": must be an object of settings; ignored`); continue; }
    const where = `profile "${name}": `;
    let onload = vals.onload ?? '';
    // A list of commands is the same as one ";" chain.
    if (Array.isArray(onload) && onload.every((c) => typeof c === 'string')) onload = onload.join('; ');
    if (typeof onload !== 'string') { problems.push(`${where}"onload" must be commands as text (or a list of them); ignored`); onload = ''; }
    out[name] = { values: sanitizeValues(vals, where, true), binds: sanitizeBinds(vals.binds, `${where}bind `), onload: onload.trim() };
  }
  return out;
}

function sanitizeMapProfiles(obj, known) {
  const out = {};
  if (obj === undefined) return out;
  if (!isObject(obj)) { problems.push('"maps" must be an object of map ID -> profile name; ignored'); return out; }
  for (const [id, name] of Object.entries(obj)) {
    if (typeof name !== 'string' || !known[name]) { problems.push(`map "${id}": no profile ${JSON.stringify(name)}; ignored`); continue; }
    out[id] = name;
  }
  return out;
}

// where: '' for your binds (quietly dropped, as before), 'profile "x": bind ' for a profile's.
function sanitizeBinds(obj, where = '') {
  const out = {};
  if (obj === undefined) return out;
  if (!isObject(obj)) { if (where) problems.push(`${where.replace(/bind $/, '')}"binds" must be an object of key -> command; ignored`); return out; }
  for (const [k, v] of Object.entries(obj)) {
    try {
      if (typeof v !== 'string' || !v.trim()) throw new Error('the command must be text');
      out[parseKeyName(k)] = v.trim();
    } catch (e) {
      if (where) problems.push(`${where}"${k}": ${e.message}; ignored`);
    }
  }
  return out;
}

// The file holds the settings plus "binds" and "history". An old "tp_key" setting
// becomes a "tp" bind.
function apply(obj) {
  problems = [];
  values = sanitizeValues(obj, '', false);
  bindMap = sanitizeBinds(obj && obj.binds);
  profileMap = sanitizeProfiles(obj && obj.profiles);
  mapProfiles = sanitizeMapProfiles(obj && obj.maps, profileMap);
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
  try { apply(JSON.parse(localStorage.getItem(LS_KEY) || '{}')); } catch { values = {}; bindMap = {}; profileMap = {}; mapProfiles = {}; }
  return 'localStorage';
}

// The file changed outside the console (you edited it): take it as it is now. A save the
// console still had waiting is dropped, or it would write over your edit.
export function reload(obj) {
  clearTimeout(saveTimer);
  saveTimer = null;
  apply(obj);
  try { localStorage.setItem(LS_KEY, JSON.stringify(obj)); } catch {}
}

export function save() {
  const data = JSON.stringify({
    ...values,
    ...(Object.keys(bindMap).length ? { binds: bindMap } : {}),
    ...(Object.keys(profileMap).length ? { profiles: Object.fromEntries(Object.entries(profileMap).map(([n, p]) => [n, profileJson(p)])) } : {}),
    ...(Object.keys(mapProfiles).length ? { maps: mapProfiles } : {}),
    ...(lines.length ? { history: lines } : {}),
  });
  try { localStorage.setItem(LS_KEY, data); } catch {}
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fetch(ROUTE.kv, { method: 'PUT', body: data }).catch(() => {});
  }, SAVE_DELAY_MS);
}

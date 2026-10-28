// Map cache (desktop/maps/<map id>.xml, written by desktop/main.js).
// Single-player custom maps come over HTTP, so desktop/main.js saves and fast-loads them
// by itself. Multiplayer maps come over the game socket and are handled here:
// - save: once a multiplayer level runs, its map text (already unpacked by the game) is
//   sent to main.js with the match's map ID.
// - fast load: joining from the lobby sends a JOIN_MATCH with a "send me the map" flag.
//   With fast_maps on and the map saved, the flag is cleared (the game does the same
//   when you rejoin a match) and the saved map is put where the game reads it. This wraps
//   the lobby connection's send method: the only game method the console replaces, only
//   while fast_maps is on, and only on the connection object (the anti-tamper scan
//   checks globals, not object methods; see ANTICHEAT.md 9.11).
import { print, TAG } from '../ui/log.js';
import { COLOR } from '../core/colors.js';
import { ROUTE, MAP, SAVE_RESULT } from '../core/shared.js';
import { game, NET } from '../game/bindings.js';
import { isActive } from '../game/level.js';
import { KEY } from '../state/schema.js';
import { settings } from '../state/store.js';

// JOIN_MATCH parts: [type, match uid, callback id, slot, "1" = send me the map, password].
const JOIN = Object.freeze({ MATCH_UID: 1, SEND_MAP: 4 });
const SEND_MAP_YES = '1';
const REPLY_OK = 'ok'; // match list reply: ["ok", JSON array of matches, JSON stats]
const SEND_WRAP = Symbol('pb2dev send wrapper');

const mapCache = new Map(); // map ID -> saved map text
const matchMaps = new Map(); // match uid -> map ID, from the lobby's match list
let lastMapText = null; // map text last saved or fast-loaded

const saveOn = () => settings.effective(KEY.SAVE_MAPS);
const fastOn = () => settings.effective(KEY.FAST_MAPS) === true;
const withId = (route, id) => `${route}?id=${encodeURIComponent(id)}`;

function saveMapText(id, text) {
  fetch(withId(ROUTE.saveMap, id), { method: 'POST', body: text })
    .then(async (r) => {
      const res = await r.text();
      if (!r.ok) { console.warn(`${TAG} map ${id} not saved: ${res}`); return; }
      if (!text.startsWith(MAP.compressedPrefix)) mapCache.set(id, text);
      if (res === SAVE_RESULT.saved) print(`Saved map ${id} to desktop/maps`, COLOR.hint);
    })
    .catch(() => {});
}

function autosaveMap() {
  if (!saveOn() || !game.isMP() || !isActive()) return;
  const text = game.mapText();
  if (typeof text !== 'string' || !text || text === lastMapText) return;
  const id = game.matchMapId();
  if (!id) return;
  lastMapText = text;
  saveMapText(String(id), text);
}

async function prefetchMaps(ids) {
  for (const id of ids) {
    if (mapCache.has(id)) continue;
    try {
      const r = await fetch(withId(ROUTE.mapFile, id), { cache: 'no-store' });
      if (r.ok) mapCache.set(id, await r.text());
    } catch {}
  }
}

function onMatchList(reply) {
  if (!reply || reply[0] !== REPLY_OK) return;
  const list = JSON.parse(reply[1]);
  if (!Array.isArray(list)) return;
  const ids = new Set();
  for (const m of list) {
    if (!m || m.uid === undefined || !m.map_id) continue;
    matchMaps.set(String(m.uid), String(m.map_id));
    ids.add(String(m.map_id));
  }
  prefetchMaps([...ids]);
}

function fastJoin(parts) {
  if (parts[JOIN.SEND_MAP] !== SEND_MAP_YES) return parts;
  const id = matchMaps.get(String(parts[JOIN.MATCH_UID]));
  const text = id && mapCache.get(id);
  if (!text) {
    if (id) print(`Fast load: map ${id} is not saved yet, downloading it`, COLOR.hint);
    return parts;
  }
  const out = parts.slice();
  out[JOIN.SEND_MAP] = '';
  game.clearMapChunks();
  game.setMapText(text);
  lastMapText = text;
  print(`Fast load: map ${id} from desktop/maps (not downloaded)`, COLOR.ok);
  return out;
}

function syncSendWrapper() {
  const conn = game.lobbyConnection();
  if (!conn) return;
  const key = game.sendMethodName();
  const own = Object.hasOwn(conn, key) ? conn[key] : null;
  const wrapped = !!(own && own[SEND_WRAP]);
  if (fastOn() && !wrapped) {
    const orig = conn[key];
    const join = game.messageType(NET.JOIN_MATCH);
    const listMatches = game.messageType(NET.GET_MATCH_LIST);
    const wrapper = function (channel, parts, callback) {
      try {
        if (Array.isArray(parts) && parts[0] === join) {
          parts = fastJoin(parts);
        } else if (Array.isArray(parts) && parts[0] === listMatches && typeof callback === 'function') {
          const cb = callback;
          callback = function (reply) {
            try { onMatchList(reply); } catch (e) { console.warn(`${TAG} match list:`, e); }
            return cb.apply(this, arguments);
          };
        }
      } catch (e) {
        console.warn(`${TAG} fast load:`, e);
      }
      return orig.call(this, channel, parts, callback);
    };
    wrapper[SEND_WRAP] = true;
    conn[key] = wrapper;
  } else if (!fastOn() && wrapped) {
    delete conn[key];
  }
}

export function mapTick() {
  syncSendWrapper();
  autosaveMap();
}

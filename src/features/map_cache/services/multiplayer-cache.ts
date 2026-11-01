import { MAP_MARKER, SAVE_RESULT } from '#shared/contract/keys.ts';
import { JOIN_PART, MESSAGE_NAME, REPLY_OK, SEND_MAP_YES, SEND_WRAP_NAME } from '../keys.ts';
import { TEXT } from '../text.ts';
import type { GameMaps } from '../adapters/game-maps.ts';

export type CacheDeps = {
  game: GameMaps;
  save: (id: string, text: string) => Promise<{ ok: boolean; answer: string }>;
  load: (id: string) => Promise<string | null>;
  say: (text: string, isGood: boolean) => void;
  warn: (...parts: unknown[]) => void;
};

type SendMethod = ((channel: unknown, parts: unknown, callback?: unknown) => unknown) & { [SEND_WRAP]?: true };
type MatchListReply = [string, string, ...unknown[]];
const SEND_WRAP: unique symbol = Symbol(SEND_WRAP_NAME);
const textOf = (value: unknown): string => (typeof value === 'string' || typeof value === 'number' ? String(value) : '');

export function createMultiplayerCache({ game, save, load, say, warn }: CacheDeps) {
  const mapCache = new Map<string, string>();
  const matchMaps = new Map<string, string>();
  let lastMapText: string | null = null;

  function saveMap(id: string, text: string): void {
    save(id, text)
      .then(({ ok, answer }) => {
        if (!ok) {
          warn(TEXT.notSaved(id, answer));
          return;
        }
        if (!text.startsWith(MAP_MARKER.compressedPrefix)) mapCache.set(id, text);
        if (answer === SAVE_RESULT.saved) say(TEXT.savedConsole(id), false);
      })
      .catch(() => undefined);
  }

  function autosave(): void {
    if (!game.isSaving() || !game.isMP() || !game.isLevelActive()) return;
    const text = game.mapText();
    if (typeof text !== 'string' || !text || text === lastMapText) return;
    const id = game.matchMapId();
    if (!id) return;
    lastMapText = text;
    saveMap(textOf(id), text);
  }

  async function prefetch(ids: readonly string[]): Promise<void> {
    for (const id of ids) {
      if (mapCache.has(id)) continue;
      const text = await load(id).catch(() => null);
      if (text) mapCache.set(id, text);
    }
  }

  function onMatchList(reply: unknown): void {
    const isOk = Array.isArray(reply) && reply[0] === REPLY_OK;
    if (!isOk) return;
    const list = JSON.parse((reply as MatchListReply)[1]) as unknown;
    if (!Array.isArray(list)) return;
    const ids = new Set<string>();
    for (const match of list as { uid?: unknown; map_id?: unknown }[]) {
      if (match?.uid === undefined || !match.map_id) continue;
      matchMaps.set(textOf(match.uid), textOf(match.map_id));
      ids.add(textOf(match.map_id));
    }
    void prefetch([...ids]);
  }

  function fastJoin(parts: unknown[]): unknown[] {
    if (parts[JOIN_PART.sendMap] !== SEND_MAP_YES) return parts;
    const id = matchMaps.get(textOf(parts[JOIN_PART.matchUid]));
    const text = id ? mapCache.get(id) : undefined;
    if (!id || !text) {
      if (id) say(TEXT.notSavedYet(id), false);
      return parts;
    }
    const changed = parts.slice();
    changed[JOIN_PART.sendMap] = '';
    game.clearMapChunks();
    game.setMapText(text);
    lastMapText = text;
    say(TEXT.fastLoaded(id), true);
    return changed;
  }

  function wrapSend(connection: Record<string, unknown>, key: string): void {
    const original = connection[key] as SendMethod;
    const joinType = game.messageType(MESSAGE_NAME.joinMatch);
    const listType = game.messageType(MESSAGE_NAME.matchList);
    const wrapped: SendMethod = function (this: unknown, channel, parts, callback) {
      let sentParts = parts;
      let sentCallback = callback;
      try {
        if (Array.isArray(parts) && parts[0] === joinType) {
          sentParts = fastJoin(parts as unknown[]);
        } else if (Array.isArray(parts) && parts[0] === listType && typeof callback === 'function') {
          const answer = callback as (...args: unknown[]) => unknown;
          sentCallback = function (this: unknown, ...args: unknown[]) {
            try {
              onMatchList(args[0]);
            } catch (error) {
              warn(TEXT.matchListFailed, error);
            }
            return answer.apply(this, args);
          };
        }
      } catch (error) {
        warn(TEXT.fastLoadFailed, error);
      }
      return original.call(this, channel, sentParts, sentCallback);
    };
    wrapped[SEND_WRAP] = true;
    connection[key] = wrapped;
  }

  function syncSendWrapper(): void {
    const connection = game.lobbyConnection();
    if (!connection) return;
    const key = game.sendMethodName();
    const own = Object.hasOwn(connection, key) ? connection[key] as SendMethod : null;
    const isWrapped = !!own?.[SEND_WRAP];
    if (game.isFastLoading() && !isWrapped) wrapSend(connection, key);
    else if (!game.isFastLoading() && isWrapped) delete connection[key];
  }

  function tick(): void {
    syncSendWrapper();
    autosave();
  }

  return { tick };
}

import { stringOf } from '#kernel/text/text-of.ts';
import { NOT_PUBLISHED, PRESET, REPLY_OK, TITLE_PREFIX } from '../keys.ts';

export type MatchPreset = Readonly<Record<string, string | number | boolean>>;

export const privateMatchPreset = (mapId: string, password: string, titleTag: string): MatchPreset => Object.freeze({
  ranked: PRESET.ranked,
  max_players: PRESET.maxPlayers,
  game_type: PRESET.gameType,
  min_reputation: PRESET.minReputation,
  title: TITLE_PREFIX + titleTag,
  map_id: mapId,
  map_rotation: PRESET.mapRotation,
  password,
  gameplay_modifications: PRESET.gameplayModifications,
  ping_limit: PRESET.pingLimit,
  rounds_until_rotation: PRESET.roundsUntilRotation,
  round_duration_str: PRESET.roundDurationText,
  round_duration: PRESET.roundDuration,
  p2p: PRESET.p2p,
  p2p_region: PRESET.p2pRegion,
  exclude_inactive_players: PRESET.excludeInactivePlayers,
  allow_vpn_guests: PRESET.allowVpnGuests,
  ping_limit_action: PRESET.pingLimitAction,
  respawn_model: PRESET.respawnModel,
  accept_connections_manually: PRESET.acceptConnectionsManually,
});

export type LobbyReply = Readonly<{ ok: boolean; detail: string }>;

export const replyOf = (parts: readonly unknown[]): LobbyReply => Object.freeze({ ok: parts[0] === REPLY_OK, detail: stringOf(parts[1] ?? '') });

export const isNotPublished = (detail: string): boolean => NOT_PUBLISHED.test(detail);

export type MapPieces = { add(index: number, total: number, text: string): void; complete(): string | null };

export function collectMapPieces(): MapPieces {
  const pieces: string[] = [];
  let expected: number | null = null;
  return {
    add(index, total, text) {
      pieces[index] = text;
      expected = total;
    },
    complete() {
      if (expected === null) return null;
      for (let index = 0; index < expected; index++) if (pieces[index] === undefined) return null;
      return pieces.slice(0, expected).join('');
    },
  };
}

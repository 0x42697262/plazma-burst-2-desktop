import type { SaveSeen } from '#kernel/game-save/seen.ts';
import { SAVE_SOURCE } from '#kernel/game-save/keys.ts';
import { GAME_ID_SHAPE, ID_SHAPE, ORIGIN } from '../keys.ts';

export type { SaveSeen };
export type IdShape = (typeof ID_SHAPE)[keyof typeof ID_SHAPE];
export type OriginKind = (typeof ORIGIN)[keyof typeof ORIGIN];
export type Origin = Readonly<{ kind: OriginKind; load: SaveSeen | null; upload: SaveSeen | null }>;

export function idShape(uid: string | null): IdShape {
  if (uid === null) return ID_SHAPE.none;
  return GAME_ID_SHAPE.test(uid) ? ID_SHAPE.game : ID_SHAPE.other;
}

export function originOf(uid: string | null, loads: readonly SaveSeen[], uploads: readonly SaveSeen[]): Origin {
  const byGame = (seen: SaveSeen): boolean => seen.source === SAVE_SOURCE.game;
  const load = loads.filter(byGame).at(-1) ?? null;
  const upload = uploads.filter(byGame).at(-1) ?? null;
  if (!load) return { kind: ORIGIN.notSeen, load, upload };
  if (load.uid === null) return { kind: ORIGIN.keptLocal, load, upload };
  return { kind: load.uid === uid ? ORIGIN.fromNetworkSave : ORIGIN.differs, load, upload };
}

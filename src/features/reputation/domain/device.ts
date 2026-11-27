import { GAME_ID_SHAPE, ID_SHAPE, ORIGIN, SAVE_KEY, SAVE_TEXT } from '../keys.ts';

export type DeviceValues = Readonly<{ uid: string | null; firstLogin: string | null; hasProof: boolean }>;
export type SaveSeen = Readonly<{ at: number; login: string; uid: string | null; firstLogin: string | null; hasProof: boolean }>;
export type IdShape = (typeof ID_SHAPE)[keyof typeof ID_SHAPE];
export type OriginKind = (typeof ORIGIN)[keyof typeof ORIGIN];
export type Origin = Readonly<{ kind: OriginKind; load: SaveSeen | null; upload: SaveSeen | null }>;

const NO_VALUES: DeviceValues = Object.freeze({ uid: null, firstLogin: null, hasProof: false });
const textOrNull = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);
const unescaped = (text: string): string => text.split(SAVE_TEXT.escapedPairEnd).join(SAVE_TEXT.pairEnd).split(SAVE_TEXT.escapedPairJoin).join(SAVE_TEXT.pairJoin);

export function saveValuesOf(text: string): DeviceValues {
  const values = new Map<string, string>();
  for (const pair of text.split(SAVE_TEXT.pairEnd)) {
    const at = pair.indexOf(SAVE_TEXT.pairJoin);
    if (at > 0) values.set(unescaped(pair.slice(0, at)), unescaped(pair.slice(at + SAVE_TEXT.pairJoin.length)));
  }
  return { uid: textOrNull(values.get(SAVE_KEY.uid)), firstLogin: textOrNull(values.get(SAVE_KEY.login)), hasProof: !!textOrNull(values.get(SAVE_KEY.proof)) };
}

export function deviceOfSave(json: string | null): DeviceValues {
  if (json === null) return NO_VALUES;
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch {
    return NO_VALUES;
  }
  if (!data || typeof data !== 'object') return NO_VALUES;
  const save = data as Record<string, unknown>;
  return { uid: textOrNull(save[SAVE_KEY.uid]), firstLogin: textOrNull(save[SAVE_KEY.login]), hasProof: !!textOrNull(save[SAVE_KEY.proof]) };
}

export function idShape(uid: string | null): IdShape {
  if (uid === null) return ID_SHAPE.none;
  return GAME_ID_SHAPE.test(uid) ? ID_SHAPE.game : ID_SHAPE.other;
}

export function originOf(uid: string | null, loads: readonly SaveSeen[], uploads: readonly SaveSeen[]): Origin {
  const load = loads.at(-1) ?? null;
  const upload = uploads.at(-1) ?? null;
  if (!load) return { kind: ORIGIN.notSeen, load, upload };
  if (load.uid === null) return { kind: ORIGIN.keptLocal, load, upload };
  return { kind: load.uid === uid ? ORIGIN.fromNetworkSave : ORIGIN.differs, load, upload };
}

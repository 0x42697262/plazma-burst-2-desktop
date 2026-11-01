import { encNum, encSigned } from '#console/testing/net-protocol.fixture.ts';

export type PlayerStateOptions = { hp?: number | ''; x?: number; y?: number; aimX?: number; aimY?: number; respawns?: number; gun?: number; clock?: number };

export function playerState({ hp = 100, x: positionX = 1264, y: positionY = -520, aimX = 212, aimY = -40, respawns = 1, gun = 2, clock = 52310 }: PlayerStateOptions = {}): string[] {
  return ['', encSigned(positionX), encSigned(positionY), '', '', '', hp === '' ? '' : encNum(hp), encSigned(aimX), encSigned(aimY), '', encNum(gun), '',
    encNum(60), encNum(90), encNum(60), encNum(75), '', '', '', encNum(clock), encNum(respawns)];
}

export const STATE_LAYOUT = Object.freeze({ x: 1, y: 2, hp: 6, aimX: 7, aimY: 8, headHp: 12, faceHp: 13, killer: 16, clock: 19, respawns: 20, velScale: 5 });

import type { SAVE_SOURCE } from './keys.ts';

export type SaveSource = (typeof SAVE_SOURCE)[keyof typeof SAVE_SOURCE];
export type SaveSeen = Readonly<{ at: number; login: string; source: SaveSource; uid: string | null; firstLogin: string | null; hasProof: boolean }>;
export type SeenSaves = Readonly<{ loads: SaveSeen[]; uploads: SaveSeen[] }>;

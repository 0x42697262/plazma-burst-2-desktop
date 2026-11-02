import { PAGE_JOIN_GLOBAL } from './keys.ts';

export type JoinTarget = Readonly<{ address: string; nickname: string; password: string }>;

export const pageJoinTarget = (): JoinTarget | null => (Reflect.get(globalThis, PAGE_JOIN_GLOBAL) as JoinTarget | undefined) ?? null;
export const isJoiningPrivateServer = (): boolean => pageJoinTarget() !== null;

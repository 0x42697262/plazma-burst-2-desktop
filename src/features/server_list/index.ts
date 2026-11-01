import { PAGE_JOIN_GLOBAL } from './keys.ts';
import type { JoinTarget } from './services/join-client.ts';

export type { JoinTarget };

export const pageJoinTarget = (): JoinTarget | null => (Reflect.get(globalThis, PAGE_JOIN_GLOBAL) as JoinTarget | undefined) ?? null;
export const isJoiningPrivateServer = (): boolean => pageJoinTarget() !== null;

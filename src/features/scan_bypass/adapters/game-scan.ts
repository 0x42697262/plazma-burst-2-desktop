import { game, NET } from '#console/kernel/game/bindings.ts';
import { UNLOCK_PHRASE, checksBypassed, askToBypass, protectAgain } from '#console/kernel/danger/bypass.ts';
import { REASON, rankedMatch } from '#console/kernel/overrides/server-checks.ts';

export type LoggedMessage = { type: unknown; parts?: unknown[] };
type ScanBindings = { netLog(): LoggedMessage[]; messageType(name: string): unknown; lockedArrayName(index: number): string | null; lockedArrayCount(): unknown };

const bindings = game as unknown as ScanBindings;

export const gameScan = {
  messages: (): LoggedMessage[] => bindings.netLog(),
  pingType: (): unknown => bindings.messageType((NET as { PING: string }).PING),
  lockedArrays: { name: (index: number): string | null => bindings.lockedArrayName(index), count: (): string => String(bindings.lockedArrayCount()) },
};

export const protection = {
  unlockPhrase: UNLOCK_PHRASE as string,
  isBypassed: (): boolean => checksBypassed(),
  ask: (): void => { askToBypass(); },
  protectAgain: (): void => { protectAgain(); },
  isRankedMatch: (): boolean => rankedMatch(),
  reasons: REASON as { hp: string; aim: string },
};

import { rewriteArguments, untap } from '#console/kernel/net/tap.ts';
import type { GameNetwork } from '#console/kernel/game/network.ts';
import { GUARD_OWNER } from '../keys.ts';
import { neutralizeTasks } from '../domain/neutralize.ts';

export type GuardDeps = {
  network: GameNetwork;
  isPrivateLobby: () => boolean;
  report: (count: number) => void;
  missing: () => void;
};

export function createLobbyTaskGuard({ network, isPrivateLobby, report, missing }: GuardDeps) {
  let guarded: object | null = null;

  const rewrite = (args: unknown[]): unknown[] => {
    const [text, ...rest] = args;
    if (typeof text !== 'string') return args;
    const { text: safe, replaced } = neutralizeTasks(text, network.digits(), (type) => network.typeName(type));
    if (!replaced) return args;
    report(replaced);
    return [safe, ...rest];
  };

  function start(): void {
    if (!isPrivateLobby()) return;
    const prototype = network.connectionPrototype();
    if (!prototype) {
      missing();
      return;
    }
    guarded = prototype;
    rewriteArguments(prototype, network.receiveMethodName(), GUARD_OWNER, rewrite);
  }

  function stop(): void {
    if (guarded) untap(guarded, network.receiveMethodName(), GUARD_OWNER);
    guarded = null;
  }

  return { start, stop, isGuarding: () => guarded !== null };
}

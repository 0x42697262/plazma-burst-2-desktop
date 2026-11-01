import { tap, untap } from '#console/kernel/net/tap.ts';
import type { GameConnection, GameNetwork } from '#console/kernel/game/network.ts';
import { STATUS, TAP_OWNER, type FingerprintKind } from '../keys.ts';
import { findTasks, type FoundTask } from '../domain/tasks.ts';
import type { SavedAnswer } from '../adapters/wrapper-client.ts';

export type CaptureDeps = {
  network: GameNetwork;
  save: (code: string, kind: FingerprintKind) => Promise<SavedAnswer>;
  isPrivateLobby: () => boolean;
  isRemote: boolean;
  announce: (saved: SavedAnswer) => void;
  warn: (message: string) => void;
};

export function createFingerprintCapture(deps: CaptureDeps) {
  const { network } = deps;
  let tapped: GameConnection | null = null;
  let lastCode: string | null = null;

  function send({ code, kind }: FoundTask): void {
    if (code === lastCode) return;
    lastCode = code;
    deps.save(code, kind)
      .then((saved) => { if (saved.status === STATUS.new) deps.announce(saved); })
      .catch((error: unknown) => deps.warn((error as Error).message));
  }

  const digitsNow = (): string => {
    try {
      return network.digits();
    } catch {
      return '';
    }
  };

  function onPacket(text: unknown): void {
    const digits = digitsNow();
    const typeName = (type: number): string | null => {
      try {
        return network.typeName(type);
      } catch {
        return null;
      }
    };
    for (const task of findTasks(text, digits, typeName)) send(task);
  }

  function tick(): void {
    const isOff = deps.isRemote || deps.isPrivateLobby();
    const method = network.receiveMethodName();
    if (isOff) {
      if (tapped) untap(tapped, method, TAP_OWNER);
      tapped = null;
      return;
    }
    const connection = network.lobbyConnection();
    if (tapped && tapped !== connection) untap(tapped, method, TAP_OWNER);
    tapped = connection;
    tap(connection, method, TAP_OWNER, onPacket);
  }

  return { tick };
}

import { game } from '#console/kernel/game/bindings.ts';
import { GAME_READY_POLL_MS } from './constants.ts';

const waiting: (() => void)[] = [];
let isReady = false;
let poll: ReturnType<typeof setInterval> | null = null;

function isGameReady(): boolean {
  try {
    return game.ready();
  } catch {
    return false;
  }
}

function check(): void {
  if (!isGameReady()) return;
  if (poll !== null) clearInterval(poll);
  poll = null;
  isReady = true;
  for (const start of waiting.splice(0)) start();
}

export function whenGameReady(start: () => void): void {
  if (isReady) {
    start();
    return;
  }
  waiting.push(start);
  poll ??= setInterval(check, GAME_READY_POLL_MS);
}

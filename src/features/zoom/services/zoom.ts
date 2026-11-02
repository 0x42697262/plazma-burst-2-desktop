import { DEFAULT_PERCENT, MAX_PERCENT, MIN_PERCENT, PERCENT, SHOWN_DECIMALS_FACTOR } from '../constants.ts';
import { TEXT } from '../text.ts';
import type { GameCamera } from '../adapters/game-camera.ts';

export type ZoomDeps = { camera: GameCamera; say: (text: string) => void; warn: (text: string) => void };

const shownZoom = (scale: number): string => TEXT.shown(Math.round(scale * PERCENT * SHOWN_DECIMALS_FACTOR) / SHOWN_DECIMALS_FACTOR);
const isValidPercent = (percent: number): boolean => Number.isFinite(percent) && percent >= MIN_PERCENT && percent <= MAX_PERCENT;

export function createZoom({ camera, say, warn }: ZoomDeps) {
  let locked: number | null = null;
  let setOnce: number | null = null;
  let isHeldNoted = false;

  function listRows(): string[] | null {
    if (locked !== null) return [TEXT.listLocked(locked)];
    const stillOnce = setOnce !== null && camera.isActive() && camera.zoom() === setOnce / PERCENT;
    if (setOnce !== null && stillOnce) return [TEXT.listOnce(setOnce)];
    setOnce = null;
    return null;
  }

  function frame(): void {
    if (!camera.isActive()) return;
    const mine = locked ?? setOnce;
    const why = mine !== null && camera.heldBack(mine);
    if (mine !== null && why) {
      if (camera.zoom() === mine / PERCENT) camera.setZoom(DEFAULT_PERCENT / PERCENT);
      if (locked === null) setOnce = null;
      if (!isHeldNoted) warn(TEXT.heldBack(mine, why, camera.bypassHint()));
      isHeldNoted = true;
      return;
    }
    isHeldNoted = false;
    if (locked !== null && camera.zoom() !== locked / PERCENT) camera.setZoom(locked / PERCENT);
  }

  function unlock(): void {
    locked = null;
    setOnce = null;
    say(TEXT.unlocked);
  }

  function show(): void {
    camera.requireLevel();
    say(TEXT.now(shownZoom(camera.zoom()), locked !== null ? TEXT.lockedAt(locked) : TEXT.notLocked));
  }

  function set(percent: number, lock: boolean): void {
    if (!isValidPercent(percent)) throw new Error(TEXT.usageError);
    const why = camera.heldBack(percent);
    if (why) throw camera.refusal(TEXT.refusedSubject(percent), why);
    if (lock) {
      locked = percent;
      setOnce = null;
      if (camera.inLevelFrame()) camera.setZoom(percent / PERCENT);
      say(TEXT.locked(percent));
      return;
    }
    camera.requireLevel();
    const wasLocked = locked !== null;
    locked = null;
    camera.setZoom(percent / PERCENT);
    setOnce = percent === DEFAULT_PERCENT ? null : percent;
    say(TEXT.set(percent, wasLocked));
  }

  return { listRows, frame, unlock, show, set };
}

export type Zoom = ReturnType<typeof createZoom>;

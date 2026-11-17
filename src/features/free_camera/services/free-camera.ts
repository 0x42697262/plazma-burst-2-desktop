import { GAME_HEIGHT, GAME_WIDTH } from '#console/kernel/game/constants.ts';
import { HALF, MAX_FRAME_SECONDS, MIDDLE_BUTTON, MS_PER_SECOND } from '../constants.ts';
import { PAN_KEYS, SHIFT_CODES } from '../keys.ts';
import { TEXT } from '../text.ts';

export type Point = { x: number; y: number };
export type CameraView = {
  isActive(): boolean;
  isAlive(): boolean;
  isWatched(): boolean;
  refusal(): Error;
  levelRequired(): Error;
  zoom(): number;
  worldOffset(): Point | null;
  setWorldOffset(x: number, y: number): void;
  stageScale(): number;
  speed(): number;
  fastFactor(): number;
};
export type KeyPress = Readonly<{ code: string; shiftKey?: boolean }>;
export type MousePress = Readonly<{ button: number; clientX?: number; clientY?: number }>;
export type MouseMove = Readonly<{ clientX: number; clientY: number }>;
export type FreeCameraDeps = { view: CameraView; now: () => number; say: (text: string) => void; warn: (text: string) => void };

const CENTER: Point = Object.freeze({ x: GAME_WIDTH * HALF, y: GAME_HEIGHT * HALF });

export function createFreeCamera({ view, now, say, warn }: FreeCameraDeps) {
  let center: Point | null = null;
  let lastTime = 0;
  let isFast = false;
  let drag: Point | null = null;
  const pressed = new Set<string>();

  const zoom = (): number => view.zoom() || 1;

  function centerOfView(): Point {
    const offset = view.worldOffset() ?? { x: 0, y: 0 };
    return { x: (CENTER.x - offset.x) / zoom(), y: (CENTER.y - offset.y) / zoom() };
  }

  function show(): void {
    if (!center) return;
    view.setWorldOffset(CENTER.x - center.x * zoom(), CENTER.y - center.y * zoom());
  }

  function releaseAll(): void {
    pressed.clear();
    drag = null;
    isFast = false;
  }

  function turnOff(message: string = TEXT.off, isWarning = false): void {
    center = null;
    releaseAll();
    (isWarning ? warn : say)(message);
  }

  function turnOn(): void {
    if (!view.isActive()) throw view.levelRequired();
    if (view.isWatched()) throw view.refusal();
    center = centerOfView();
    lastTime = now();
    say(TEXT.on);
  }

  function toggle(): void {
    if (center) turnOff();
    else turnOn();
  }

  function frame(): void {
    if (!center) return;
    if (!view.isActive() || !view.isAlive()) {
      turnOff(TEXT.endedLevel);
      return;
    }
    if (view.isWatched()) {
      turnOff(TEXT.endedWatched, true);
      return;
    }
    const time = now();
    const seconds = Math.min(MAX_FRAME_SECONDS, Math.max(0, (time - lastTime) / MS_PER_SECOND));
    lastTime = time;
    let directionX = 0;
    let directionY = 0;
    for (const code of pressed) {
      const [stepX, stepY] = PAN_KEYS[code] ?? [0, 0];
      directionX += stepX;
      directionY += stepY;
    }
    const distance = (view.speed() * (isFast ? view.fastFactor() : 1) * seconds) / zoom();
    center = { x: center.x + Math.sign(directionX) * distance, y: center.y + Math.sign(directionY) * distance };
    show();
  }

  function keyDown(event: KeyPress): boolean {
    if (!center) return false;
    if (SHIFT_CODES.includes(event.code)) {
      isFast = true;
      return false;
    }
    if (!PAN_KEYS[event.code]) return false;
    pressed.add(event.code);
    isFast = event.shiftKey === true;
    return true;
  }

  function keyUp(event: KeyPress): void {
    if (SHIFT_CODES.includes(event.code)) isFast = false;
    pressed.delete(event.code);
  }

  function mouseDown(event: MousePress): boolean {
    if (!center || event.button !== MIDDLE_BUTTON) return false;
    drag = { x: event.clientX ?? 0, y: event.clientY ?? 0 };
    return true;
  }

  function mouseMove(event: MouseMove): void {
    if (!center || !drag) return;
    const scale = view.stageScale();
    center = { x: center.x - ((event.clientX - drag.x) * scale) / zoom(), y: center.y - ((event.clientY - drag.y) * scale) / zoom() };
    drag = { x: event.clientX, y: event.clientY };
  }

  function mouseUp(event: MousePress): boolean {
    if (!drag || event.button !== MIDDLE_BUTTON) return false;
    drag = null;
    return true;
  }

  return { isOn: (): boolean => center !== null, turnOn, turnOff: (): void => { if (center) turnOff(); }, toggle, frame, keyDown, keyUp, mouseDown, mouseMove, mouseUp, releaseAll };
}

export type FreeCamera = ReturnType<typeof createFreeCamera>;

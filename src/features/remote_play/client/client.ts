import { CLIENT_LINE_PX, CLIENT_RECONNECT_MS, CLIENT_STATUS_MS, DOM_BUTTONS, DOM_DELTA, MODIFIER_BIT, NO_MODIFIERS } from '../constants.ts';
import { AUTHORITY_START, BLOB_BINARY_TYPE, BROWSER_EVENT, CLIENT_CONTEXT_2D, CLIENT_ELEMENT, EMPTY_KEY, MESSAGE, PIXEL_UNIT, SECURE_PAGE_SCHEME, TOKEN_PARAMETER, WS_PATH, WS_SCHEME } from '../keys.ts';
import { CLIENT_TEXT } from '../text.ts';

type Size = { width: number; height: number };
type Point = { x: number; y: number };
type Modified = { shiftKey: boolean; ctrlKey: boolean; altKey: boolean; metaKey: boolean };
type ServerMessage = { t?: string; width?: number; height?: number; name?: string; message?: string };

const element = <Found extends HTMLElement>(id: string): Found => document.getElementById(id) as Found;
const canvas = element<HTMLCanvasElement>(CLIENT_ELEMENT.screen);
const drawing2d = canvas.getContext(CLIENT_CONTEXT_2D);
const overlay = element<HTMLDivElement>(CLIENT_ELEMENT.overlay);
const messageBox = element<HTMLDivElement>(CLIENT_ELEMENT.message);
const playButton = element<HTMLButtonElement>(CLIENT_ELEMENT.play);
const statusLine = element<HTMLSpanElement>(CLIENT_ELEMENT.status);

const token = new URLSearchParams(location.hash.slice(1)).get(TOKEN_PARAMETER);

let socket: WebSocket | null = null;
let size: Size = { width: canvas.width, height: canvas.height };
let testerName = '';
let playing = false;
let fatal = false;
let pendingFrame: Blob | null = null;
let isDrawing = false;
let framesThisSecond = 0;
let pendingMove: (Point & { m: number }) | null = null;
const heldKeys = new Set<string>();

function show(text: string | null, withPlayButton = false): void {
  overlay.hidden = text === null;
  if (text !== null) messageBox.textContent = text;
  playButton.hidden = !withPlayButton;
}

function fit(): void {
  const scale = Math.min(innerWidth / size.width, innerHeight / size.height);
  canvas.style.width = `${Math.floor(size.width * scale)}${PIXEL_UNIT}`;
  canvas.style.height = `${Math.floor(size.height * scale)}${PIXEL_UNIT}`;
}

const send = (message: Record<string, unknown>): void => {
  if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(message));
};

function releaseKeys(): void {
  for (const code of heldKeys) send({ t: MESSAGE.keyUp, code, key: EMPTY_KEY, m: NO_MODIFIERS });
  heldKeys.clear();
}

async function drawPending(): Promise<void> {
  isDrawing = true;
  while (pendingFrame) {
    const blob = pendingFrame;
    pendingFrame = null;
    try {
      const bitmap = await createImageBitmap(blob);
      drawing2d?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      bitmap.close();
      framesThisSecond++;
    } catch {
      continue;
    }
  }
  isDrawing = false;
}

function onServerMessage(message: ServerMessage): void {
  if (message.t === MESSAGE.ready) {
    size = { width: message.width ?? size.width, height: message.height ?? size.height };
    testerName = message.name ?? '';
    canvas.width = size.width;
    canvas.height = size.height;
    fit();
    if (playing) show(null);
    else show(CLIENT_TEXT.connected, true);
  } else if (message.t === MESSAGE.error) {
    fatal = true;
    show(message.message ?? CLIENT_TEXT.hostClosed);
  }
}

function connect(): void {
  const scheme = location.protocol === SECURE_PAGE_SCHEME ? WS_SCHEME.secure : WS_SCHEME.plain;
  const opened = new WebSocket(scheme + AUTHORITY_START + location.host + WS_PATH);
  socket = opened;
  opened.binaryType = BLOB_BINARY_TYPE;
  opened.onopen = () => { opened.send(JSON.stringify({ t: MESSAGE.hello, token })); };
  opened.onmessage = (event: MessageEvent<Blob | string>) => {
    if (typeof event.data !== 'string') {
      pendingFrame = event.data;
      if (!isDrawing) void drawPending();
      return;
    }
    try {
      onServerMessage(JSON.parse(event.data) as ServerMessage);
    } catch {
      return;
    }
  };
  opened.onclose = () => {
    heldKeys.clear();
    if (fatal) return;
    show(CLIENT_TEXT.reconnecting);
    setTimeout(connect, CLIENT_RECONNECT_MS);
  };
}

setInterval(() => {
  statusLine.textContent = socket?.readyState === WebSocket.OPEN ? CLIENT_TEXT.status(testerName, framesThisSecond) : CLIENT_TEXT.noStatus;
  framesThisSecond = 0;
}, CLIENT_STATUS_MS);

const modifierBits = (event: Modified): number => (event.shiftKey ? MODIFIER_BIT.shift : 0) | (event.ctrlKey ? MODIFIER_BIT.ctrl : 0)
  | (event.altKey ? MODIFIER_BIT.alt : 0) | (event.metaKey ? MODIFIER_BIT.meta : 0);

function startPlaying(): void {
  playing = true;
  canvas.focus();
  show(null);
}

const keyListener = (type: typeof MESSAGE.keyDown | typeof MESSAGE.keyUp) => (event: KeyboardEvent): void => {
  if (!playing) return;
  event.preventDefault();
  if (type === MESSAGE.keyDown) heldKeys.add(event.code);
  else heldKeys.delete(event.code);
  send({ t: type, code: event.code, key: event.key, m: modifierBits(event), r: event.repeat });
};
addEventListener(BROWSER_EVENT.keyDown, keyListener(MESSAGE.keyDown), true);
addEventListener(BROWSER_EVENT.keyUp, keyListener(MESSAGE.keyUp), true);
addEventListener(BROWSER_EVENT.blur, releaseKeys);
document.addEventListener(BROWSER_EVENT.visibility, () => { if (document.hidden) releaseKeys(); });

function streamPoint(event: MouseEvent): Point {
  const box = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - box.left) / box.width) * size.width,
    y: ((event.clientY - box.top) / box.height) * size.height,
  };
}

canvas.addEventListener(BROWSER_EVENT.pointerMove, (event: PointerEvent) => {
  if (!playing) return;
  pendingMove = { ...streamPoint(event), m: modifierBits(event) };
});
const flushMove = (): void => {
  if (pendingMove) {
    send({ t: MESSAGE.mouseMove, ...pendingMove });
    pendingMove = null;
  }
  requestAnimationFrame(flushMove);
};
requestAnimationFrame(flushMove);

canvas.addEventListener(BROWSER_EVENT.pointerDown, (event: PointerEvent) => {
  if (!playing) {
    startPlaying();
    return;
  }
  if (!DOM_BUTTONS.has(event.button)) return;
  event.preventDefault();
  canvas.setPointerCapture(event.pointerId);
  send({ t: MESSAGE.mouseMove, ...streamPoint(event), m: modifierBits(event) });
  send({ t: MESSAGE.mouseDown, ...streamPoint(event), b: event.button, m: modifierBits(event) });
});
canvas.addEventListener(BROWSER_EVENT.pointerUp, (event: PointerEvent) => {
  if (!playing || !DOM_BUTTONS.has(event.button)) return;
  event.preventDefault();
  send({ t: MESSAGE.mouseUp, ...streamPoint(event), b: event.button, m: modifierBits(event) });
});
canvas.addEventListener(BROWSER_EVENT.wheel, (event: WheelEvent) => {
  if (!playing) return;
  event.preventDefault();
  const scale = event.deltaMode === DOM_DELTA.line ? CLIENT_LINE_PX : event.deltaMode === DOM_DELTA.page ? size.height : 1;
  send({ t: MESSAGE.wheel, ...streamPoint(event), dx: event.deltaX * scale, dy: event.deltaY * scale, m: modifierBits(event) });
}, { passive: false });
canvas.addEventListener(BROWSER_EVENT.contextMenu, (event) => { event.preventDefault(); });

playButton.addEventListener(BROWSER_EVENT.click, startPlaying);
element<HTMLButtonElement>(CLIENT_ELEMENT.fullscreen).addEventListener(BROWSER_EVENT.click, () => {
  if (document.fullscreenElement) void document.exitFullscreen();
  else document.documentElement.requestFullscreen().catch(() => undefined);
  canvas.focus();
});
addEventListener(BROWSER_EVENT.resize, fit);

fit();
if (token) connect();
else show(CLIENT_TEXT.needsLink);

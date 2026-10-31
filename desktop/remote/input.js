// Remote play input: a tester's browser sends its keys and mouse as small JSON messages
// (desktop/remote/client/client.js); this turns each into the events Electron replays
// into the tester's game window (webContents.sendInputEvent), which the game cannot tell
// from real ones. Anything malformed or blocked (isBlockedKey: paste, host tools) becomes
// no event at all.
//
// Messages (m: modifier bits 1 shift, 2 ctrl, 4 alt, 8 meta):
//   { t: 'kd' | 'ku', code, key, m, r }   key down / up; code and key as in KeyboardEvent; r: repeat
//   { t: 'mm', x, y, m }                  mouse move, in stream pixels
//   { t: 'md' | 'mu', x, y, b, m }        mouse button down / up; b: 0 left, 1 middle, 2 right
//   { t: 'wh', x, y, dx, dy, m }          wheel, DOM deltas (positive dy = down)
'use strict';

const { isBlockedKey } = require('./lockdown');

const MOD = Object.freeze({ shift: 1, ctrl: 2, alt: 4, meta: 8 });
const BUTTONS = Object.freeze(['left', 'middle', 'right']);
const MAX_TEXT = 32; // longer "key"/"code" strings are not keys

// KeyboardEvent.code -> Electron accelerator key name (layout independent: the key's place).
const NAMED = Object.freeze({
  Backquote: '`', Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\',
  Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/', IntlBackslash: '\\',
  Space: 'Space', Enter: 'Enter', NumpadEnter: 'Enter', Escape: 'Escape', Backspace: 'Backspace', Tab: 'Tab',
  Delete: 'Delete', Insert: 'Insert', Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown',
  ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
  ShiftLeft: 'Shift', ShiftRight: 'Shift', ControlLeft: 'Control', ControlRight: 'Control',
  AltLeft: 'Alt', AltRight: 'Alt', MetaLeft: 'Meta', MetaRight: 'Meta', CapsLock: 'Capslock',
  NumLock: 'Numlock', ScrollLock: 'Scrolllock', PrintScreen: 'PrintScreen',
  NumpadAdd: 'numadd', NumpadSubtract: 'numsub', NumpadMultiply: 'nummult', NumpadDivide: 'numdiv', NumpadDecimal: 'numdec',
});

function electronKey(code) {
  if (NAMED[code]) return NAMED[code];
  let m = /^Key([A-Z])$/.exec(code);
  if (m) return m[1];
  m = /^Digit([0-9])$/.exec(code);
  if (m) return m[1];
  m = /^Numpad([0-9])$/.exec(code);
  if (m) return `num${m[1]}`;
  m = /^F([1-9]|1[0-9]|2[0-4])$/.exec(code);
  if (m) return code;
  return null;
}

const modifiers = (m) => {
  const bits = Number.isInteger(m) ? m : 0;
  const out = [];
  if (bits & MOD.shift) out.push('shift');
  if (bits & MOD.ctrl) out.push('control');
  if (bits & MOD.alt) out.push('alt');
  if (bits & MOD.meta) out.push('meta');
  return out;
};

const isText = (v) => typeof v === 'string' && v.length > 0 && v.length <= MAX_TEXT;
const clamp = (v, max) => Math.min(Math.max(Math.round(v), 0), max - 1);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

// One message -> Electron input events ([] when ignored). size: { width, height } of the
// stream, for clamping mouse positions.
function toInputEvents(msg, size) {
  if (!msg || typeof msg !== 'object') return [];
  const mods = modifiers(msg.m);
  if (msg.t === 'kd' || msg.t === 'ku') {
    if (!isText(msg.code)) return [];
    const keyCode = electronKey(msg.code);
    if (!keyCode) return [];
    const bits = Number.isInteger(msg.m) ? msg.m : 0;
    const key = isText(msg.key) ? msg.key : '';
    if (isBlockedKey({ key, code: msg.code, shift: !!(bits & MOD.shift), ctrl: !!(bits & MOD.ctrl), alt: !!(bits & MOD.alt), meta: !!(bits & MOD.meta) })) return [];
    if (msg.t === 'ku') return [{ type: 'keyUp', keyCode, modifiers: mods }];
    const down = { type: 'keyDown', keyCode, modifiers: msg.r ? [...mods, 'isAutoRepeat'] : mods };
    // Typed text (the console, the game's chat) needs a "char" event: one printable
    // character, without ctrl/meta (those are shortcuts, not text).
    const typed = [...key].length === 1 && !(bits & (MOD.ctrl | MOD.meta)) && key >= ' ';
    return typed ? [down, { type: 'char', keyCode: key, modifiers: mods }] : [down];
  }
  if (!isNum(msg.x) || !isNum(msg.y) || !size) return [];
  const x = clamp(msg.x, size.width);
  const y = clamp(msg.y, size.height);
  if (msg.t === 'mm') return [{ type: 'mouseMove', x, y, modifiers: mods }];
  if (msg.t === 'md' || msg.t === 'mu') {
    const button = BUTTONS[msg.b];
    if (!button) return [];
    return [{ type: msg.t === 'md' ? 'mouseDown' : 'mouseUp', x, y, button, clickCount: 1, modifiers: mods }];
  }
  if (msg.t === 'wh') {
    if (!isNum(msg.dx) || !isNum(msg.dy)) return [];
    // Chromium's wheel events count up as positive; the DOM counts down as positive.
    return [{ type: 'mouseWheel', x, y, deltaX: -msg.dx, deltaY: -msg.dy, canScroll: true, modifiers: mods }];
  }
  return [];
}

// Keys still down when a tester leaves: released so the game does not keep running left.
function releaseAll(codes) {
  const out = [];
  for (const code of codes) {
    const keyCode = electronKey(code);
    if (keyCode) out.push({ type: 'keyUp', keyCode, modifiers: [] });
  }
  return out;
}

module.exports = { MOD, toInputEvents, releaseAll, electronKey };

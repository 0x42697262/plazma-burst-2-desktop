// Key names for binds. Keys are named by their physical key (KeyboardEvent.code), so
// shift+1 is "shift+1", not "shift+!". Modifiers are always written ctrl+alt+shift+.

const SYMBOL_KEYS = Object.freeze({
  '`': 'backquote', '-': 'minus', '=': 'equal', '[': 'bracketleft', ']': 'bracketright',
  '\\': 'backslash', ';': 'semicolon', "'": 'quote', ',': 'comma', '.': 'period', '/': 'slash',
  ' ': 'space', esc: 'escape', return: 'enter', del: 'delete', ins: 'insert',
  up: 'arrowup', down: 'arrowdown', left: 'arrowleft', right: 'arrowright', pgup: 'pageup', pgdn: 'pagedown',
});
const MODIFIERS = Object.freeze(['ctrl', 'alt', 'shift']);
const MOD_ALIASES = Object.freeze({ control: 'ctrl', ctl: 'ctrl', option: 'alt' });

// Opens and closes the console. Plain ` stays the game's "swords" key; the game only
// uses Shift for free-camera speed, so Shift+` is free.
export const TOGGLE_KEY = 'shift+backquote';
// Used by the console input and the game chat, so they cannot be bound.
const INPUT_KEYS = Object.freeze(['escape', 'enter']);

const normalize = (base) => base.replace(/^key([a-z])$/, '$1').replace(/^digit(\d)$/, '$1');

// "Shift+F" / "KeyF" / "digit5" / "`" -> "shift+f", "f", "5", "backquote". Throws if invalid.
export function parseKeyName(raw) {
  const parts = String(raw || '').toLowerCase().split('+');
  let base = parts.pop();
  if (base === '' && parts.length && parts[parts.length - 1] === '') { parts.pop(); base = '+'; }
  const mods = new Set();
  for (const m of parts) {
    const mod = MOD_ALIASES[m] || m;
    if (!MODIFIERS.includes(mod)) throw new Error(`unknown modifier "${m}" (use ctrl+, alt+, shift+)`);
    mods.add(mod);
  }
  base = normalize(SYMBOL_KEYS[base] || base);
  if (!base || !/^[a-z0-9]+$/.test(base)) throw new Error(`"${raw}" is not a key name. Examples: f, 5, f2, space, numpad1, shift+t`);
  if (MODIFIERS.includes(base) || /^(control|shift|alt|meta)(left|right)?$/.test(base)) throw new Error('a modifier alone cannot be bound; use e.g. shift+f');
  const name = [...MODIFIERS.filter((m) => mods.has(m)), base].join('+');
  if (name === TOGGLE_KEY) throw new Error(`${showKey(TOGGLE_KEY)} opens the console`);
  if (INPUT_KEYS.includes(base)) throw new Error(`${base} is used by the console and chat`);
  return name;
}

// The key of a KeyboardEvent, in the same form as parseKeyName.
export function eventKeyName(e) {
  let base = String(e.code || '').toLowerCase();
  if (!base) base = SYMBOL_KEYS[String(e.key).toLowerCase()] || String(e.key || '').toLowerCase();
  base = normalize(base);
  if (!base) return '';
  const mods = [e.ctrlKey && 'ctrl', e.altKey && 'alt', e.shiftKey && 'shift'].filter(Boolean);
  return [...mods, base].join('+');
}

export const showKey = (k) => k.replace(/\bbackquote\b/, '`');
export const baseKey = (k) => k.split('+').pop();

// Keys the game reads (keyCodes in frame2.js). A bind on one hides it from the game.
export const GAME_KEYS = Object.freeze({
  w: 'jump', a: 'move left', s: 'crouch', d: 'move right', space: 'jump', arrowup: 'jump', arrowdown: 'crouch',
  arrowleft: 'move left', arrowright: 'move right', e: 'use', insert: 'use', g: 'grenade', numpad0: 'grenade',
  q: 'previous weapon', v: 'drop weapon', backspace: 'drop weapon', x: 'action', z: 'zoom', pageup: 'zoom',
  pagedown: 'zoom', c: 'game key', r: 'game key', t: 'game key', p: 'game key', tab: 'score table', end: 'score table',
  backquote: 'swords', 0: 'swords', 1: 'weapon 1', 2: 'weapon 2', 3: 'weapon 3', 4: 'weapon 4', 5: 'weapon 5',
  6: 'weapon 6', 7: 'weapon 7', 8: 'weapon 8', 9: 'weapon 9', f1: 'game key', f2: 'game key', f3: 'game key',
  f4: 'game key', f5: 'quick save', f9: 'quick load',
});

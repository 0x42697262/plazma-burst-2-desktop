// The console window, styled after the game's "View logs" panel (800x400 game units),
// and the keys it reacts to: Shift+` toggles it, Esc closes it, binds run in levels.
import { el } from './dom.js';
import { print, attachLog, clearLog } from './log.js';
import { complete } from './complete.js';
import { COLOR } from '../core/colors.js';
import { game } from '../game/bindings.js';
import { isActive } from '../game/level.js';
import { eventKeyName, showKey, baseKey, TOGGLE_KEY } from '../state/keys.js';
import { binds, history, settings } from '../state/store.js';
import { KEY } from '../state/schema.js';
import { levelWasActive } from '../overrides/frame.js';
import { run } from '../dispatch.js';

const THEME = Object.freeze({
  background: '#0E2236e5',
  scrollThumb: '#3C9DFF',
  scrollTrack: '#01010119',
  inputBackground: '#00000066',
  inputBorder: '1px solid rgba(60,157,255,0.3)',
  font: 'DejaVuSansMono',
  titleFont: 'EuropeExt',
});
const Z_INDEX = '50';
const BUTTON_STEP = 190; // horizontal distance between the buttons

// Keep the game's handlers (on window and document, bubble phase) from seeing input
// meant for the console.
const SWALLOWED_EVENTS = ['keydown', 'keypress', 'mousedown', 'mouseup', 'click', 'dblclick',
  'wheel', 'contextmenu', 'pointerdown', 'pointerup', 'touchstart', 'touchend'];

let root, inputEl, statusEl;
let isOpen = false;
let historyPos = 0; // where Up/Down is in the typed history
let toggleKeyHeld = false; // swallow the keyup of a Shift+` we handled, even if Shift goes up first
const heldBoundKeys = new Set(); // e.code of bound keys that are down, to swallow their keyup
let keyCatcher = null; // takes the next key press instead of everything else ("keyname")

const MODIFIER_CODE = /^(shift|control|alt|meta|os)(left|right)?$/i;

// The next key pressed (not a modifier on its own) goes to fn(e) and nowhere else, or
// fn(null) for Esc. Returns a function that gives up waiting.
export function catchNextKey(fn) {
  keyCatcher = fn;
  return () => { if (keyCatcher === fn) keyCatcher = null; };
}

export function updateStatus() {
  if (!statusEl) return;
  const [text, color] = game.isMP() ? ['MULTIPLAYER', COLOR.ok]
    : levelWasActive() ? ['ACTIVE', COLOR.ok]
      : ['IDLE: start a level to apply', COLOR.notice];
  statusEl.textContent = text;
  statusEl.style.color = color;
}

export const updateStatusIfOpen = () => { if (isOpen) updateStatus(); };

export function openPanel() {
  if (isOpen) return;
  isOpen = true;
  if (document.pointerLockElement) document.exitPointerLock();
  root.style.display = 'block';
  updateStatus();
  setTimeout(() => inputEl.focus(), 0);
}

export function closePanel() {
  if (!isOpen) return;
  isOpen = false;
  root.style.display = 'none';
  inputEl.blur();
}

// Out of sight but still open (input and focus kept), e.g. for a screenshot.
export function setPanelHidden(hidden) {
  if (root) root.style.visibility = hidden ? 'hidden' : 'visible';
}

const togglePanel = () => (isOpen ? closePanel() : openPanel());

function onInputKey(e) {
  if (e.key === 'Enter') {
    const line = inputEl.value;
    inputEl.value = '';
    history.add(line);
    historyPos = history.lines.length;
    run(line);
  } else if (e.key === 'ArrowUp') {
    if (historyPos > 0) { historyPos--; inputEl.value = history.lines[historyPos]; }
    e.preventDefault();
  } else if (e.key === 'ArrowDown') {
    if (historyPos < history.lines.length) historyPos++;
    inputEl.value = history.lines[historyPos] || '';
    e.preventDefault();
  } else if (e.key === 'Tab') {
    e.preventDefault();
    const { value, hits } = complete(inputEl.value);
    if (value !== undefined) inputEl.value = value;
    else if (hits) print(hits.join('  '), COLOR.hint);
  }
}

export function buildPanel() {
  root = el('div', {
    position: 'absolute', left: '10px', top: '40px', width: '780px', height: '320px',
    background: THEME.background, visibility: 'visible', display: 'none', zIndex: Z_INDEX,
    cursor: 'default', boxSizing: 'border-box', fontFamily: THEME.font, color: COLOR.plain,
    userSelect: 'text', pointerEvents: 'auto',
  });
  root.id = 'pb2dev';

  root.append(el('div', {
    position: 'absolute', left: '0', top: '4px', width: '100%', textAlign: 'center',
    fontFamily: THEME.titleFont, fontSize: '10px', color: COLOR.bright,
  }, 'Developer console'));

  statusEl = el('div', { position: 'absolute', right: '10px', top: '6px', fontSize: '6px', color: COLOR.title });
  root.append(statusEl);

  const logEl = el('div', {
    position: 'absolute', left: '10px', top: '20px', width: '760px', height: '246px',
    overflowY: 'auto', fontSize: '7px', lineHeight: '8px', whiteSpace: 'pre-wrap',
    wordBreak: 'break-word', scrollbarWidth: 'thin', scrollbarColor: `${THEME.scrollThumb} ${THEME.scrollTrack}`,
  });
  root.append(logEl);
  attachLog(logEl);

  inputEl = document.createElement('input');
  inputEl.className = 'pb2Input';
  inputEl.type = 'text';
  inputEl.spellcheck = false;
  inputEl.autocomplete = 'off';
  inputEl.placeholder = 'type a command, e.g. "god on" or "help"';
  Object.assign(inputEl.style, {
    position: 'absolute', left: '10px', top: '270px', width: '760px', height: '16px',
    fontSize: '7px', padding: '2px 4px', background: THEME.inputBackground,
    border: THEME.inputBorder, visibility: 'visible',
  });
  root.append(inputEl);

  const buttons = [
    ['Close', closePanel],
    ['Clear', clearLog],
    ['List values', () => run('list')],
    ['Help', () => run('help')],
  ];
  buttons.forEach(([caption, fn], i) => {
    const b = document.createElement('pb2Button');
    b.textContent = caption;
    Object.assign(b.style, {
      position: 'absolute', left: `${15 + i * BUTTON_STEP}px`, top: '293px',
      width: '180px', height: '20px', fontSize: '9px',
    });
    b.addEventListener('click', (e) => { e.stopPropagation(); fn(); inputEl.focus(); });
    root.append(b);
  });

  for (const type of SWALLOWED_EVENTS) root.addEventListener(type, (e) => e.stopPropagation());
  inputEl.addEventListener('keydown', onInputKey);
  historyPos = history.lines.length;
  game.overlay().append(root);
}

const isTextInput = (t) => !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable);

// A function key types nothing, so it can take a screenshot while you type.
const typesNothing = (k) => /^f\d+$/.test(baseKey(k));

export function onKeyDownCapture(e) {
  if (keyCatcher) {
    e.preventDefault();
    e.stopImmediatePropagation();
    if (MODIFIER_CODE.test(e.code || '') || e.repeat) return; // wait for the whole combination
    heldBoundKeys.add(e.code);
    const fn = keyCatcher;
    keyCatcher = null;
    fn(e.key === 'Escape' && !e.ctrlKey && !e.altKey && !e.shiftKey ? null : e);
    return;
  }
  const inRoot = root && root.contains(e.target);
  const shotKey = settings.effective(KEY.SCREENSHOT_KEY);
  if (shotKey && !e.metaKey && eventKeyName(e) === shotKey
    && (typesNothing(shotKey) || (!isTextInput(e.target) && !game.chatTyping()))) {
    // Before binds and the game: anywhere, also with the console open.
    e.preventDefault();
    e.stopImmediatePropagation();
    heldBoundKeys.add(e.code);
    if (!e.repeat) run('screenshot', `key ${showKey(shotKey)}`);
    return;
  }
  if (!e.metaKey && eventKeyName(e) === TOGGLE_KEY) {
    if (!(!inRoot && isTextInput(e.target)) && !game.chatTyping()) {
      e.preventDefault();
      e.stopImmediatePropagation();
      toggleKeyHeld = true;
      if (!e.repeat) togglePanel();
      return;
    }
  }
  if (!isOpen && !e.metaKey) {
    const k = eventKeyName(e);
    const bound = k && binds.active(k); // this map's profile bind, or yours
    if (bound && !isTextInput(e.target) && !game.chatTyping() && isActive()) {
      // The game never sees a bound key: not the press, the repeats, or the release.
      e.preventDefault();
      e.stopImmediatePropagation();
      heldBoundKeys.add(e.code);
      if (!e.repeat) run(bound.command, `${bound.profile ? `profile ${bound.profile} ` : ''}bind ${showKey(k)}`);
      return;
    }
  }
  if (!isOpen) return;
  if (e.key === 'Escape') {
    e.preventDefault();
    e.stopImmediatePropagation();
    closePanel();
    return;
  }
  if (!inRoot) {
    // Swallow game keys while the console is open.
    e.stopImmediatePropagation();
    inputEl.focus();
  }
}

export function onKeyUpCapture(e) {
  // Shift may already be up, so compare the key without its modifiers.
  if (toggleKeyHeld && baseKey(eventKeyName(e)) === baseKey(TOGGLE_KEY)) { toggleKeyHeld = false; e.stopImmediatePropagation(); }
  else if (heldBoundKeys.delete(e.code)) e.stopImmediatePropagation();
}

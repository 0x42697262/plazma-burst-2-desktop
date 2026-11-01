import { isFeatureOn } from '../../flags.ts';
import { COLOR } from '../core/keys.ts';
import { game } from '../game/bindings.ts';
import { isActive } from '../game/level.ts';
import { eventKeyName, showKey, baseKey, TOGGLE_KEY } from '../state/key-names.ts';
import { binds, history } from '../state/store.ts';
import { hotkeyOf } from '../state/hotkeys.ts';
import { levelWasActive } from '../overrides/frame.ts';
import { run, maskLine } from '../dispatch.ts';
import { commandForPaste, handledByAFeature } from '../ports/input.ts';
import { el } from './dom.ts';
import { THEME, IN_OVERLAY, swallow, markUi } from './theme.ts';
import { print, attachLog, clearLog } from './log.ts';
import { complete } from './complete.ts';
import { BUTTON_LEFT, BUTTON_STEP } from './constants.ts';
import {
  BUTTON_STYLE, FUNCTION_KEY, INPUT_STYLE, LINE_BREAK, LINE_SPLIT, LOG_STYLE, MODIFIER_CODE, PANEL, PANEL_KEY, PIXELS, PROFILE_FEATURE_FLAGS,
  ROOT_STYLE, SPACE, STATUS_STYLE, TEXT_INPUT_TAGS, TITLE_STYLE, scrollbarColors,
} from './keys.ts';
import { PANEL_TEXT as TEXT } from './text.ts';

type CaughtKey = (event: KeyboardEvent | null) => void;
type Overlay = { append(node: Node): void };

let root: HTMLDivElement | null = null;
let inputElement: HTMLInputElement | null = null;
let statusElement: HTMLDivElement | null = null;
let isOpen = false;
let historyPosition = 0;
let toggleKeyHeld = false;
const heldBoundKeys = new Set<string>();
let keyCatcher: CaughtKey | null = null;

export function catchNextKey(report: CaughtKey): () => void {
  keyCatcher = report;
  return () => {
    if (keyCatcher === report) keyCatcher = null;
  };
}

export function updateStatus(): void {
  if (!statusElement) return;
  const [text, color] = game.isMP() ? [TEXT.multiplayer, COLOR.ok]
    : levelWasActive() ? [TEXT.active, COLOR.ok]
      : [TEXT.idle, COLOR.notice];
  statusElement.textContent = text;
  statusElement.style.color = color;
}

export const updateStatusIfOpen = (): void => {
  if (isOpen) updateStatus();
};

export function openPanel(): void {
  if (isOpen || !root) return;
  isOpen = true;
  if (document.pointerLockElement) document.exitPointerLock();
  root.style.display = PANEL.shown;
  updateStatus();
  setTimeout(() => { inputElement?.focus(); }, 0);
}

export function closePanel(): void {
  if (!isOpen || !root) return;
  isOpen = false;
  root.style.display = PANEL.hidden;
  inputElement?.blur();
}

export function setPanelHidden(hidden: boolean): void {
  if (root) root.style.visibility = hidden ? PANEL.invisible : PANEL.visible;
}

const togglePanel = (): void => {
  if (isOpen) closePanel();
  else openPanel();
};

function onInputKey(event: KeyboardEvent): void {
  const input = inputElement;
  if (!input) return;
  if (event.key === PANEL_KEY.enter) {
    const line = input.value;
    input.value = '';
    history.add(maskLine(line));
    historyPosition = history.lines.length;
    run(line);
  } else if (event.key === PANEL_KEY.up) {
    if (historyPosition > 0) {
      historyPosition--;
      input.value = history.lines[historyPosition] ?? '';
    }
    event.preventDefault();
  } else if (event.key === PANEL_KEY.down) {
    if (historyPosition < history.lines.length) historyPosition++;
    input.value = history.lines[historyPosition] || '';
    event.preventDefault();
  } else if (event.key === PANEL_KEY.tab) {
    event.preventDefault();
    const { value, hits } = complete(input.value);
    if (value !== undefined) input.value = value;
    else if (hits) print(hits.join(PANEL.hintSeparator), COLOR.hint);
  }
}

type Pasteable = { value: string; selectionStart: number | null; selectionEnd: number | null };

export function pasteText(text: string, input: Pasteable | null = inputElement): boolean {
  const prefix = input && LINE_BREAK.test(text) ? commandForPaste(text) : null;
  if (!input || prefix === null) return false;
  const oneLine = text.split(LINE_SPLIT).map((line) => line.trim()).filter(Boolean).join(SPACE);
  const value = input.value || '';
  const start = input.selectionStart ?? value.length;
  const before = value.slice(0, start);
  const after = value.slice(input.selectionEnd ?? start);
  const lead = before.trim() ? before : prefix;
  input.value = lead + oneLine + after;
  input.selectionStart = input.selectionEnd = lead.length + oneLine.length;
  return true;
}

function onPaste(event: ClipboardEvent): void {
  if (pasteText(event.clipboardData?.getData(PANEL.textType) || '')) event.preventDefault();
}

export function buildPanel(): void {
  const panel = el('div', {
    ...ROOT_STYLE, background: THEME.background, ...IN_OVERLAY, display: PANEL.hidden, zIndex: PANEL.zIndex,
    fontFamily: THEME.font, color: COLOR.plain,
  });
  root = panel;
  panel.id = PANEL.id;
  markUi(panel);

  panel.append(el('div', { ...TITLE_STYLE, fontFamily: THEME.titleFont, color: COLOR.bright }, PANEL.title));

  statusElement = el('div', { ...STATUS_STYLE, color: COLOR.title });
  panel.append(statusElement);

  const logElement = el('div', { ...LOG_STYLE, scrollbarColor: scrollbarColors(THEME.scrollThumb, THEME.scrollTrack) });
  panel.append(logElement);
  attachLog(logElement);

  const input = document.createElement('input');
  inputElement = input;
  input.className = PANEL.inputClass;
  input.type = PANEL.inputType;
  input.spellcheck = false;
  input.autocomplete = PANEL.autocomplete;
  input.placeholder = PANEL.placeholder;
  Object.assign(input.style, { ...INPUT_STYLE, background: THEME.inputBackground, border: THEME.inputBorder, ...IN_OVERLAY });
  panel.append(input);

  const buttons: readonly (readonly [string, () => void])[] = [
    [TEXT.buttons.close, closePanel],
    [TEXT.buttons.clear, clearLog],
    [TEXT.buttons.list, () => { run(PANEL.listCommand); }],
    [TEXT.buttons.help, () => { run(PANEL.helpCommand); }],
  ];
  buttons.forEach(([caption, action], position) => {
    const button = document.createElement(PANEL.buttonElement);
    button.textContent = caption;
    Object.assign(button.style, { ...BUTTON_STYLE, left: PIXELS(BUTTON_LEFT + position * BUTTON_STEP) });
    button.addEventListener(PANEL.clickEvent, (event) => {
      event.stopPropagation();
      action();
      input.focus();
    });
    panel.append(button);
  });

  swallow(panel);
  input.addEventListener(PANEL.keyDownEvent, onInputKey);
  input.addEventListener(PANEL.pasteEvent, onPaste);
  historyPosition = history.lines.length;
  (game.overlay() as Overlay).append(panel);
}

const isTextInput = (target: EventTarget | null): boolean => {
  const element = target as HTMLElement | null;
  return !!element && (TEXT_INPUT_TAGS.includes(element.tagName) || element.isContentEditable);
};

const typesNothing = (key: string): boolean => FUNCTION_KEY.test(baseKey(key));

function swallowEvent(event: KeyboardEvent): void {
  event.preventDefault();
  event.stopImmediatePropagation();
}

function catchKey(event: KeyboardEvent, report: CaughtKey): void {
  swallowEvent(event);
  if (MODIFIER_CODE.test(event.code || '') || event.repeat) return;
  heldBoundKeys.add(event.code);
  keyCatcher = null;
  const isPlainEscape = event.key === PANEL_KEY.escape && !event.ctrlKey && !event.altKey && !event.shiftKey;
  report(isPlainEscape ? null : event);
}

export function onKeyDownCapture(event: KeyboardEvent): void {
  if (keyCatcher) {
    catchKey(event, keyCatcher);
    return;
  }
  const keyName = eventKeyName(event);
  const isInRoot = !!root && root.contains(event.target as Node | null);
  const isTyping = isTextInput(event.target) || !!game.chatTyping();
  const hotkey = !event.metaKey ? hotkeyOf(keyName) : undefined;
  if (hotkey && (typesNothing(keyName) || !isTyping)) {
    swallowEvent(event);
    heldBoundKeys.add(event.code);
    if (!event.repeat) run(hotkey.command, TEXT.keySource(showKey(keyName)));
    return;
  }
  if (!event.metaKey && keyName === TOGGLE_KEY && !(!isInRoot && isTextInput(event.target)) && !game.chatTyping()) {
    swallowEvent(event);
    toggleKeyHeld = true;
    if (!event.repeat) togglePanel();
    return;
  }
  if (!isOpen && !isTyping && handledByAFeature(event)) {
    swallowEvent(event);
    heldBoundKeys.add(event.code);
    return;
  }
  if (!isOpen && !event.metaKey && isFeatureOn(PROFILE_FEATURE_FLAGS.binds)) {
    const bound = keyName ? binds.active(keyName) : null;
    if (bound && !isTyping && isActive()) {
      swallowEvent(event);
      heldBoundKeys.add(event.code);
      if (!event.repeat) run(bound.command, TEXT.bindSource(bound.profile, showKey(keyName)));
      return;
    }
  }
  if (!isOpen) return;
  if (event.key === PANEL_KEY.escape) {
    swallowEvent(event);
    closePanel();
    return;
  }
  if (!isInRoot) {
    event.stopImmediatePropagation();
    inputElement?.focus();
  }
}

export function onKeyUpCapture(event: KeyboardEvent): void {
  const isToggleRelease = toggleKeyHeld && baseKey(eventKeyName(event)) === baseKey(TOGGLE_KEY);
  if (isToggleRelease) {
    toggleKeyHeld = false;
    event.stopImmediatePropagation();
  } else if (heldBoundKeys.delete(event.code)) {
    event.stopImmediatePropagation();
  }
}
